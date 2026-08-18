# ---------------------------------------------------------------------------
# RESUME → INTERNSHIP MATCHING = the "agent" that ties resume parsing
# (app/resume_parser.py) together with the internship vector index
# (app/services/internship_index.py).
# ---------------------------------------------------------------------------
# Given a parsed Resume row, this:
#   1. Builds a query text out of whatever the resume actually has (skills +
#      education + summary, falling back to raw text from the DB if empty —
#      same "never block, degrade gracefully" approach as resume_parser.py).
#
#   2. Pulls a WIDER candidate pool from FAISS (not just the final top-k) —
#      semantic similarity alone is a weak final ranking signal, so more
#      candidates are pulled and then re-ranked on the factors that actually
#      matter for "is this internship right for this student":
#        - skill_score:     matched / required skills ratio            (50%)
#        - semantic_score:  the FAISS similarity (still useful —       (20%)
#                           captures domain fit the other scores can't)
#        - education_score: does the resume's degree level match        (15%)
#                           what the posting asks for
#        - location_score:  does the resume's location match the        (15%)
#                           posting's (remote postings always match)
#
#   3. Combines those into one composite score (skills weighted highest,
#      since that's the primary signal), re-sorts by it, and returns the
#      top-k with the full breakdown so a caller can see *why* something
#      is/isn't a good match, not just a bare number.
#
#   4. Optionally asks Groq for one short natural-language summary of the
#      whole result set. Best-effort: returns None on any failure — a
#      summary is a nice-to-have, not something a match request should fail.
#
# NOTE: Assignment 3's Resume model stores skills as a JSONB list
#       (e.g. ["Python", "SQL"]) rather than a comma-separated string.
#       This module handles both formats transparently.
# ---------------------------------------------------------------------------

import re

from app.config import settings
from app.models import Resume
from app.services.internship_index import list_all_postings, search_similar_internships

MAX_EXTRACTED_TEXT_CHARS_FOR_QUERY = 2000  # fallback only; skills/education are preferred

CANDIDATE_POOL_MULTIPLIER = 4  # pull ~4× k from FAISS before re-ranking
MIN_CANDIDATE_POOL = 20

WEIGHT_SKILL = 0.50
WEIGHT_SEMANTIC = 0.20
WEIGHT_EDUCATION = 0.15
WEIGHT_LOCATION = 0.15

BACHELORS_RE = re.compile(r"\b(b\.?\s?tech|b\.?\s?e\.?|b\.?\s?sc|bca|bba|bachelor'?s?)\b", re.IGNORECASE)
MASTERS_RE = re.compile(r"\b(m\.?\s?tech|m\.?\s?e\.?|m\.?\s?sc|mca|mba|master'?s?)\b", re.IGNORECASE)
PHD_RE = re.compile(r"ph\.?d", re.IGNORECASE)
DIPLOMA_RE = re.compile(r"diploma", re.IGNORECASE)


def _resume_skills_set(resume: Resume) -> set[str]:
    """Normalise skills to a lowercase set regardless of storage format.

    Assignment 3 stores skills as a JSONB list: ["Python", "SQL", ...]
    Milestone 2 used a comma-separated string: "Python, SQL, ..."
    This function accepts both so the matcher works with either format.
    """
    raw = resume.skills
    if not raw:
        # Also try technical_skills if main skills is empty
        raw = getattr(resume, "technical_skills", None)
        if not raw:
            return set()

    if isinstance(raw, list):
        return {s.strip().lower() for s in raw if isinstance(s, str) and s.strip()}
    if isinstance(raw, str):
        return {s.strip().lower() for s in raw.split(",") if s.strip()}
    return set()


def _skills_to_display_str(resume: Resume) -> str:
    """Comma-separated skills string for display / LLM prompt."""
    raw = resume.skills or getattr(resume, "technical_skills", None)
    if not raw:
        return ""
    if isinstance(raw, list):
        return ", ".join(s for s in raw if isinstance(s, str) and s.strip())
    return str(raw)


def _education_str(resume: Resume) -> str | None:
    """Return a plain-text education string from either a string or a JSONB
    list of education dicts (Assignment 3 stores education as a JSONB list
    with keys degree/institution/year/etc.)."""
    raw = resume.education
    if not raw:
        return None
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list) and raw:
        # Take the first (most recent) entry and flatten to a string
        entry = raw[0]
        if isinstance(entry, dict):
            parts = [entry.get("degree") or "", entry.get("institution") or ""]
            return " ".join(p for p in parts if p).strip() or None
        if isinstance(entry, str):
            return entry
    return None


def build_query_text(resume: Resume) -> str:
    """Builds the text to embed and search with. Prefers the structured
    parsed fields (skills, education, summary) since they're clean signal;
    only falls back to raw extracted text if parsing came up completely empty."""
    parts = []

    skills_str = _skills_to_display_str(resume)
    if skills_str:
        parts.append(f"Skills: {skills_str}")

    edu = _education_str(resume)
    if edu:
        parts.append(f"Education: {edu}")

    if resume.professional_summary:
        parts.append(f"Summary: {resume.professional_summary}")

    # Work experience titles/descriptions also help semantic matching
    work_exp = getattr(resume, "work_experience", None) or []
    if isinstance(work_exp, list):
        for exp in work_exp[:3]:
            if isinstance(exp, dict):
                title = exp.get("title") or exp.get("role") or ""
                desc = exp.get("description") or ""
                if title:
                    parts.append(f"Experience: {title} — {desc}"[:200])

    # Project names/tech_stack also carry domain signal
    projects = getattr(resume, "projects", None) or []
    if isinstance(projects, list):
        for proj in projects[:3]:
            if isinstance(proj, dict):
                name = proj.get("name") or ""
                tech = proj.get("tech_stack") or proj.get("technologies") or ""
                if name:
                    parts.append(f"Project: {name} ({tech})"[:200])

    if parts:
        return "\n".join(parts)

    # Absolute fallback: stored raw text from the DB (if resume_parser saved it)
    raw_text = getattr(resume, "extracted_text", None) or ""
    if raw_text:
        return raw_text[:MAX_EXTRACTED_TEXT_CHARS_FOR_QUERY]

    return ""


def _skill_gap(resume_skills: set[str], posting_required: list[str]) -> tuple[list[str], list[str]]:
    matched = [s for s in posting_required if s.lower() in resume_skills]
    missing = [s for s in posting_required if s.lower() not in resume_skills]
    return matched, missing


def _degree_level(text: str) -> str | None:
    """Coarse degree-level classification shared by resumes and postings,
    so "B.Tech" on a resume can be compared against "Pursuing B.Tech/B.E."
    on a posting without needing an exact string match."""
    if MASTERS_RE.search(text):
        return "masters"
    if BACHELORS_RE.search(text):
        return "bachelors"
    if PHD_RE.search(text):
        return "phd"
    if DIPLOMA_RE.search(text):
        return "diploma"
    return None


def _education_score(resume_education: str | None, posting_min_education: str) -> float:
    if not resume_education:
        return 0.5  # unknown — don't penalize
    if "any bachelor" in posting_min_education.lower():
        return 1.0  # posting explicitly accepts any bachelor's-level candidate
    resume_level = _degree_level(resume_education)
    posting_level = _degree_level(posting_min_education)
    if resume_level is None or posting_level is None:
        return 0.5
    return 1.0 if resume_level == posting_level else 0.3


def _city(location: str) -> str:
    return location.split(",")[0].strip().lower()


def _location_score(resume_location: str | None, posting: dict) -> float:
    if posting.get("mode") == "Remote" or _city(posting.get("location", "")) == "remote":
        return 1.0  # location-agnostic postings always match
    if not resume_location:
        return 0.5  # unknown — don't penalize
    resume_city = _city(resume_location)
    posting_city = _city(posting.get("location", ""))
    if not resume_city or not posting_city:
        return 0.5
    return 1.0 if resume_city == posting_city else 0.0


def _match_label(composite: float) -> str:
    if composite >= 0.85:
        return "Perfect Match"
    if composite >= 0.65:
        return "Strong Match"
    if composite >= 0.40:
        return "Partial Match"
    return "Weak Match"


def _summarize_matches(skills_text: str, matches: list[dict]) -> str | None:
    """Best-effort Groq call for a short natural-language summary of the
    result set. Returns None (never raises) if no API key is configured or
    the call fails for any reason."""
    if not settings.groq_api_key or not matches:
        return None

    try:
        from groq import Groq

        client = Groq(api_key=settings.groq_api_key)
        listing = "\n".join(
            f"- {m['role_title']} at {m['company']} ({m['domain']}, {m['match_percentage']}% match): "
            f"requires {', '.join(m['required_skills'])}"
            for m in matches[:5]
        )
        prompt = (
            "A student has these skills: "
            f"{skills_text}\n\n"
            "These internships were found as the closest matches:\n"
            f"{listing}\n\n"
            "In 2-3 sentences, summarize how well the student's skills fit "
            "these internships overall, and suggest 1-2 skills worth "
            "learning to open up more/better matches. Be specific and "
            "concise, no preamble."
        )
        completion = client.chat.completions.create(
            model=settings.groq_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return completion.choices[0].message.content.strip()
    except Exception:
        return None


def match_resume_to_internships(resume: Resume, k: int = 5) -> dict:
    """Returns {query_skills, results, summary}. `results` is always a list
    (possibly empty if the resume has no usable text at all — the caller
    decides whether that's a 400)."""
    query_text = build_query_text(resume)
    if not query_text:
        return {"query_skills": None, "results": [], "summary": None}

    resume_skills = _resume_skills_set(resume)
    resume_edu = _education_str(resume)
    # Location: Assignment 3 uses 'address'; Milestone 2 used 'location'
    resume_location = getattr(resume, "location", None) or getattr(resume, "address", None)

    catalog_size = len(list_all_postings())
    pool_size = min(catalog_size, max(k * CANDIDATE_POOL_MULTIPLIER, MIN_CANDIDATE_POOL))
    candidates = search_similar_internships(query_text, k=pool_size)

    scored = []
    for posting in candidates:
        matched, missing = _skill_gap(resume_skills, posting["required_skills"])
        skill_score = len(matched) / len(posting["required_skills"]) if posting["required_skills"] else 0.5
        semantic_score = posting["match_score"]  # FAISS-derived, already ~0-1
        education_score = _education_score(resume_edu, posting["min_education"])
        location_score = _location_score(resume_location, posting)

        composite = (
            WEIGHT_SKILL * skill_score
            + WEIGHT_SEMANTIC * semantic_score
            + WEIGHT_EDUCATION * education_score
            + WEIGHT_LOCATION * location_score
        )

        scored.append(
            {
                **posting,
                "match_score": round(composite, 4),
                "match_percentage": round(composite * 100, 1),
                "match_label": _match_label(composite),
                "semantic_score": round(semantic_score, 4),
                "skill_score": round(skill_score, 4),
                "education_score": round(education_score, 4),
                "location_score": round(location_score, 4),
                "matched_skills": matched,
                "missing_skills": missing,
            }
        )

    scored.sort(key=lambda m: m["match_score"], reverse=True)
    results = scored[:k]

    skills_display = _skills_to_display_str(resume) or query_text
    summary = _summarize_matches(skills_display, results)

    return {"query_skills": _skills_to_display_str(resume), "results": results, "summary": summary}
