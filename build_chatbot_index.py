import os
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import sys
from pathlib import Path

# Ensure app imports work
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.chatbot_rag import build_chatbot_index

if __name__ == "__main__":
    print("Building chatbot FAISS index...")
    build_chatbot_index()
    print("\n[OK] Done! The API server will use this index for chatbot responses.")
