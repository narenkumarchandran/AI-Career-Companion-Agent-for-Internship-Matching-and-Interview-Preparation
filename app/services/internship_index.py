# ---------------------------------------------------------------------------
# INTERNSHIP VECTOR INDEX = embed every posting in app/data/internships.json
# and store the vectors in a FAISS index for similarity search.
# ---------------------------------------------------------------------------
# Two things live here:
#   1. build_index() — a one-off (re-runnable) step that reads the synthetic
#      postings, embeds each one, and saves a FAISS index to disk. Run it
#      whenever internships.json changes:
#          python build_index.py   (from the project root)
#   2. search_similar_internships() — what the matching endpoint actually
#      calls at request time. It loads the already-built index (once per
#      process, then cached) and returns the top-k most similar postings to
#      whatever query text it's given (usually a resume's skills/education).
#
# Postings and resumes are embedded into the *same* vector space, so
# "distance between vectors" doubles as "how similar this resume's skills
# are to what this posting is asking for" — that's the whole RAG mechanism.
#
# Uses HuggingFace transformers + raw FAISS directly.
# Does NOT import sentence_transformers (which has a torchvision conflict
# on some environments) — instead implements mean-pooling manually, which
# is exactly what all-MiniLM-L6-v2 does internally.
# ---------------------------------------------------------------------------

import json
import os
import pickle
from pathlib import Path

# Must be set before any OpenMP/MKL-linked library loads (torch, faiss, etc.)
# to prevent memory allocation errors on Windows.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import faiss
import numpy as np
import torch

from app.config import settings

# Resolves paths relative to the project root regardless of where the
# process is launched from (this file lives at app/services/, so
# parent.parent.parent steps back out to the project root).
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# Cached at module level so the (relatively slow) embedding model + FAISS
# index are only loaded once per process, not on every request.
_faiss_index: "faiss.Index | None" = None
_tokenizer = None
_model = None
_postings_cache: list[dict] | None = None


def _get_encoder():
    """Lazy-load the tokenizer and model (downloads on first call)."""
    global _tokenizer, _model
    if _tokenizer is None:
        from transformers import AutoTokenizer, AutoModel  # type: ignore
        _tokenizer = AutoTokenizer.from_pretrained(settings.embedding_model)
        _model = AutoModel.from_pretrained(settings.embedding_model)
        _model.eval()
    return _tokenizer, _model


def _mean_pool(model_output, attention_mask) -> torch.Tensor:
    """Mean pooling over token embeddings — standard way to get a sentence
    vector from a transformer. Exactly how all-MiniLM-L6-v2 is designed
    to be used (https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)."""
    token_embeddings = model_output.last_hidden_state
    mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    return torch.sum(token_embeddings * mask_expanded, 1) / torch.clamp(mask_expanded.sum(1), min=1e-9)


def _encode(texts: list[str], batch_size: int = 32) -> np.ndarray:
    """Encode a list of texts into L2-normalised embedding vectors."""
    tokenizer, model = _get_encoder()
    all_embeddings = []

    with torch.no_grad():
        for i in range(0, len(texts), batch_size):
            batch = texts[i: i + batch_size]
            encoded = tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt",
            )
            output = model(**encoded)
            embeddings = _mean_pool(output, encoded["attention_mask"])
            # L2 normalise each vector
            norms = embeddings.norm(dim=1, keepdim=True).clamp(min=1e-9)
            embeddings = (embeddings / norms).cpu().numpy()
            all_embeddings.append(embeddings)
            if len(texts) > batch_size:
                print(f"  Encoded {min(i + batch_size, len(texts))}/{len(texts)}")

    return np.vstack(all_embeddings).astype(np.float32)


def _posting_to_text(posting: dict) -> str:
    """Turns one posting's fields into a single text blob to embed. Order/
    repetition here matters for retrieval quality: skills are what a
    resume's query text is mostly made of, so they're included plainly
    (not buried in a sentence) to weigh them appropriately."""
    parts = [
        f"{posting['role_title']} at {posting['company']}",
        f"Domain: {posting['domain']}",
        f"Required skills: {', '.join(posting['required_skills'])}",
        f"Preferred skills: {', '.join(posting['preferred_skills'])}",
        f"Minimum education: {posting['min_education']}",
        posting["description"],
    ]
    return "\n".join(parts)


def _load_postings() -> list[dict]:
    path = PROJECT_ROOT / settings.internship_data_path
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def list_all_postings() -> list[dict]:
    """All postings from internships.json, cached in memory after the first
    call. Used by GET /internships/ to let the frontend browse the catalog
    without going through the vector index."""
    global _postings_cache
    if _postings_cache is None:
        _postings_cache = _load_postings()
    return _postings_cache


def build_index() -> None:
    """Reads app/data/internships.json, embeds every posting, and saves a
    FAISS index to settings.internship_index_dir. Safe to re-run any time
    the postings dataset changes."""
    postings = _load_postings()
    texts = [_posting_to_text(p) for p in postings]

    print(f"Encoding {len(texts)} postings with {settings.embedding_model}…")
    vectors = _encode(texts)  # already L2-normalised

    dim = vectors.shape[1]
    index = faiss.IndexFlatIP(dim)  # Inner Product on L2-normalised = cosine similarity
    index.add(vectors)

    index_dir = PROJECT_ROOT / settings.internship_index_dir
    index_dir.mkdir(parents=True, exist_ok=True)

    faiss.write_index(index, str(index_dir / "index.faiss"))
    with open(index_dir / "postings.pkl", "wb") as f:
        pickle.dump(postings, f)

    print(f"[OK] Indexed {len(postings)} postings -> {index_dir}")


def _load_index():
    """Loads the saved FAISS index once per process and caches it."""
    global _faiss_index, _postings_cache
    if _faiss_index is None:
        index_dir = PROJECT_ROOT / settings.internship_index_dir
        faiss_path = index_dir / "index.faiss"
        pkl_path = index_dir / "postings.pkl"

        if not faiss_path.exists():
            raise FileNotFoundError(
                f"No internship index found at {index_dir}. Run "
                "`python build_index.py` from the project root to build it."
            )

        _faiss_index = faiss.read_index(str(faiss_path))
        with open(pkl_path, "rb") as f:
            _postings_cache = pickle.load(f)

    return _faiss_index


def search_similar_internships(query_text: str, k: int = 5) -> list[dict]:
    """Returns the top-k postings most similar to query_text, each as the
    posting's dict plus a match_score (cosine similarity, 0–1 range)."""
    index = _load_index()
    postings = list_all_postings()

    query_vec = _encode([query_text])  # shape (1, dim), already normalised

    k_capped = min(k, index.ntotal)
    scores, indices = index.search(query_vec, k_capped)

    matches = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0:
            continue
        # Cosine similarity after L2-normalisation is already in [0, 1]
        sim = float(max(0.0, min(1.0, score)))
        matches.append({**postings[idx], "match_score": round(sim, 4)})

    return matches


if __name__ == "__main__":
    build_index()
