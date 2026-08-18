"""
build_index.py — one-off script to build the FAISS internship vector index.

Run from the project root (same directory as this file):
    python build_index.py

What it does:
  1. Reads app/data/internships.json (100+ synthetic postings)
  2. Embeds each posting using sentence-transformers/all-MiniLM-L6-v2
     (downloads ~90 MB on the first run, cached in ~/.cache/huggingface)
  3. Saves the FAISS index to app/data/faiss_internship_index/

Re-run any time internships.json changes. The API server will automatically
use the new index on the next request (or restart).
"""

# Set these BEFORE any other imports to prevent OMP/MKL memory allocation
# errors on Windows (common when multiple OpenMP runtimes are present).
import os
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import sys
from pathlib import Path

# Make sure the project root is on sys.path so `app.*` imports work when
# this script is run directly (not via `python -m`).
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.internship_index import build_index

if __name__ == "__main__":
    print("Building internship FAISS index...")
    print("(First run downloads ~90 MB embedding model - this can take 1-2 minutes)\n")
    build_index()
    print("\n[OK] Done! The API server will use this index for matching requests.")
    print("   Run: uvicorn app.main:app --reload")
    print("   Run: streamlit run frontend/streamlit_app.py")
