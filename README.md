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

## 🏃 Sprint Overview

This project was developed across **5 sprints**, each delivering a distinct layer of the platform:

| Sprint | Focus Area | Key Deliverables |
|--------|-----------|------------------|
| **Sprint 1** | Resume Parsing (Regex + LLM) | Hybrid extraction pipeline: deterministic regex for contact fields (email, phone, LinkedIn, GitHub) + Groq LLM for free-form sections (skills, education, experience, projects, certifications). Merged output stored as JSONB in PostgreSQL. |
| **Sprint 2** | Backend Development | Full FastAPI backend: SQLAlchemy ORM, JWT auth (access + refresh tokens, bcrypt hashing, token rotation), PostgreSQL schema, all REST endpoints (`/auth`, `/resume`, `/internships`, `/chat`), and FAISS internship index build pipeline. |
| **Sprint 3** | Frontend Creation | React 18 + TypeScript + Vite SPA with 9 pages (Home, Login, Dashboard, Resumes, Resume Match, Jobs, ATS Score, Interview Agent, Profile), TailwindCSS dark-mode design, AppShell sidebar, and auth state management via Context API. |
| **Sprint 4** | Resume Matching + Chatbot Integration | FAISS semantic internship matching with multi-signal re-ranking (skill overlap 50%, semantic similarity 20%, education 15%, location 15%); floating InternAI chatbot widget powered by RAG over a product knowledge document with per-session PostgreSQL conversation memory. |
| **Sprint 5** | Interview Preparation Agent | Resume-aware AI coach (`/chat/agent/*`): reads the candidate's parsed resume from the DB and generates personalised interview questions, model answers referencing their own projects, skill gap analysis, learning roadmaps, and time-bound preparation plans via LangChain + Groq. |

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
