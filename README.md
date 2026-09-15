# 🚀 AI Career Companion

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

An end-to-end, AI-powered career platform for students: upload a resume, get semantically ranked internship matches, prepare for interviews with a personalised AI coach, chat with the InternAI assistant, and analyse any document with RAG.

> **Full technical documentation:** see [DOCUMENTATION.md](DOCUMENTATION.md)

---

## Features at a Glance

| Feature | Description |
|---|---|
| 🔐 **Auth** | JWT access/refresh tokens, bcrypt passwords, token rotation |
| 📄 **Resume Upload & Parsing** | PDF/DOCX ≤ 5 MB; hybrid regex + Groq LLM extraction |
| 🎯 **RAG Internship Matching** | FAISS + `all-MiniLM-L6-v2`; multi-signal re-ranking |
| 💬 **InternAI Chatbot** | RAG over product knowledge doc + PostgreSQL conversation memory |
| 🤖 **Interview Agent** | Resume-aware AI coach: questions, roadmaps, gap analysis |
| 📝 **Document Q&A** | Upload any PDF/DOCX and ask questions with RAG |
| 📈 **ATS Score** | Resume vs job-description ATS compatibility check |
| 🖥️ **React SPA** | React 18 + TypeScript + TailwindCSS + Vite; 9 pages |

---

## Quick Start

### Prerequisites
- Python 3.10+, Node.js 18+, PostgreSQL

### 1 — Backend
```bash
python -m venv myvenv && myvenv\Scripts\activate
pip install -r app/requirements.txt
```

Create the database:
```sql
CREATE DATABASE ai_internship_agent;
```

Copy `.env.example` → `.env` and set `DATABASE_URL`, `SECRET_KEY`, `GROQ_API_KEY`.

Build FAISS indices (one-off):
```bash
python build_index.py
python build_chatbot_doc.py
python build_chatbot_index.py
```

Start the API:
```bash
uvicorn app.main:app --reload
# Docs: http://127.0.0.1:8000/docs
```

### 2 — Frontend
```bash
cd react-frontend
npm install
npm run dev
# App: http://localhost:5173
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | FastAPI (Python 3.10+) |
| Frontend | React 18, TypeScript, TailwindCSS, Vite |
| LLM | Groq API — `llama-3.3-70b-versatile` via LangChain |
| Embeddings | HuggingFace `all-MiniLM-L6-v2` (CPU, local) |
| Vector DB | FAISS |
| Database | PostgreSQL via SQLAlchemy 2.0 |
| Auth | JWT HS256 + bcrypt |

---

## Project Layout

```
milestone_assignment_2/
├── app/                  # FastAPI backend
│   ├── routers/          #   auth, resume, internships, chatbot
│   ├── services/         #   RAG, matching, interview agent, doc Q&A
│   └── data/             #   internships.json, FAISS indices, product knowledge
├── react-frontend/       # React SPA (9 pages + floating chat widget)
├── uploads/              # Per-user resume files
├── build_index.py        # Build internship FAISS index
├── build_chatbot_doc.py  # Generate product knowledge DOCX
├── build_chatbot_index.py # Build chatbot FAISS index
├── .env.example
└── DOCUMENTATION.md      # Full technical reference
```

---

## API Overview

| Router | Prefix | Key Endpoints |
|---|---|---|
| Auth | `/auth` | register, login, me, refresh, logout, reset-password |
| Resume | `/resume` | upload, list, download |
| Internships | `/internships` | catalog (public), `/match/{id}` (RAG) |
| Chatbot | `/chat` | sessions, agent/sessions, document/upload, document/{id}/message |

Full endpoint reference with request/response schemas: [DOCUMENTATION.md](DOCUMENTATION.md)

---

## License

[MIT](LICENSE) © 2026 Naren Kumar Chandran
