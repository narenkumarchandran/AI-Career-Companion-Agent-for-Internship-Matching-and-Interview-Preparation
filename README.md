# 🚀 AI Career Assistant

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

An AI-powered, full-stack internship platform that helps students go from uploading a resume to receiving semantically ranked internship recommendations — with skill-gap analysis, AI-generated summaries, and a rich Streamlit UI.

> **Version 2.0** — RAG-powered matching engine on top of the auth + resume foundation from v1.

---

## What This Project Does

The AI Career Assistant is a **backend API + Streamlit frontend** that provides:

| Feature | Description |
|---|---|
| 🔐 **Secure Auth** | JWT access/refresh token system with bcrypt, rotation, and revocation |
| 📄 **Resume Upload & Storage** | PDF/DOCX upload (≤ 5 MB), stored per-user on disk with DB metadata |
| 🧠 **AI Resume Parsing** | Hybrid regex + LLM pipeline (Groq `llama-3.3-70b-versatile`) extracts skills, education, experience, projects, and contact info |
| 🎯 **RAG-Powered Matching** | Embeds resumes and internship postings into the same vector space using `all-MiniLM-L6-v2`; FAISS finds semantically similar roles |
| 📊 **Multi-Signal Re-ranking** | Re-ranks FAISS candidates by skill overlap (50%), semantic similarity (20%), education match (15%), and location fit (15%) |
| 💬 **LLM Match Summary** | Groq generates a 2–3 sentence plain-language summary of how well the student fits the top results |
| 🔍 **Internship Catalog** | Browse all postings (unauthenticated); filter by domain, location, mode |
| 🖥️ **Streamlit Frontend** | Premium dark glassmorphism UI with 5 pages: Login/Register, My Resumes, Find Internships, Browse Catalog, Test Scenarios |

---

## System Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                        STUDENT (Browser)                            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  HTTP
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Streamlit Frontend  (frontend/streamlit_app.py)        │
│  Pages: Login · My Resumes · Find Internships · Browse · Test       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  REST API calls
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend  (app/)                           │
│                                                                     │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐    │
│  │ /auth      │  │ /resume      │  │ /internships             │    │
│  │ register   │  │ upload       │  │ GET /         (catalog)  │    │
│  │ login      │  │ list         │  │ GET /match/{id}  (RAG)   │    │
│  │ refresh    │  │ download     │  └──────────┬───────────────┘    │
│  │ logout     │  └──────┬───────┘             │                    │
│  │ me         │         │                     │                    │
│  └──────┬─────┘         │                     │                    │
│         │               ▼                     ▼                    │
│         │     ┌──────────────────┐  ┌──────────────────────────┐   │
│         │     │  resume_parser   │  │  internship_matcher      │   │
│         │     │  (Hybrid parse)  │  │  (RAG re-ranking agent)  │   │
│         │     │  regex + Groq    │  └──────────┬───────────────┘   │
│         │     └────────┬─────────┘             │                   │
│         │              │                       ▼                   │
│         │              │            ┌──────────────────────────┐   │
│         │              │            │  internship_index        │   │
│         │              │            │  FAISS + MiniLM-L6-v2    │   │
│         │              │            │  (Vector Search)         │   │
│         │              │            └──────────────────────────┘   │
│         │              │                                           │
└─────────┼──────────────┼───────────────────────────────────────────┘
          │              │
          ▼              ▼
┌──────────────────────────────────────────────────────────┐
│               PostgreSQL  (SQLAlchemy ORM)               │
│  Tables: users · refresh_tokens · resumes                │
└──────────────────────────────────────────────────────────┘
```

---

## How It Works

### 1. Authentication Flow

```
Student ──► POST /auth/register ──► bcrypt hash password ──► INSERT users row
Student ──► POST /auth/login    ──► verify hash ──► issue access token (30 min)
                                                      + refresh token (7 days, DB-stored)
Protected request ──► Bearer <access_token> ──► JWT decode & validate
Refresh ──► POST /auth/refresh ──► revoke old token ──► issue new pair (rotation)
Logout  ──► POST /auth/logout  ──► mark refresh token revoked in DB
```

**Security properties:**
- Passwords stored as bcrypt hashes only — never plain text
- Refresh tokens stored in DB so they can be revoked (logout, compromise)
- Token rotation: every use of a refresh token invalidates the old one
- Account enumeration prevention: identical error messages for "wrong email" and "wrong password"
- Resume IDs served as UUIDs (unguessable); ownership enforced server-side

---

### 2. Resume Upload & Parsing Flow

```
POST /resume/upload (multipart PDF/DOCX)
  │
  ├── 1. Validate: type (pdf/docx), size (≤ 5 MB)
  ├── 2. Save to disk: uploads/resumes/<user_id>/<uuid>.<ext>
  ├── 3. Insert DB row (parsed_status = "pending")
  └── 4. Run resume_parser.py
            │
            ├── Extract raw text (PyMuPDF for PDF, python-docx for DOCX)
            │
            ├── REGEX PASS — deterministic, fast
            │     email, phone, LinkedIn URL, GitHub URL
            │
            ├── LLM PASS — contextual, flexible (Groq llama-3.3-70b-versatile)
            │     skills, education, work_experience, projects,
            │     certifications, achievements, professional_summary
            │
            └── MERGE: regex fields take priority for contact info
                        LLM fields fill everything else
                        ── UPDATE resume row (parsed_status = "parsed")
                        ── On any failure: parsed_status = "failed"
                           (upload still succeeds, file is safe)
```

---

### 3. RAG Internship Matching Flow

This is the core AI pipeline. It runs when a student hits **GET /internships/match/{resume_id}**.

```
Step 1 — Build query text from parsed resume fields
   Skills → Education → Professional Summary → Work Experience titles → Projects

Step 2 — Embed query with all-MiniLM-L6-v2 (HuggingFace, CPU, local)
   Resumes and postings are embedded into the SAME 384-dim vector space

Step 3 — FAISS search (IndexFlatIP = cosine similarity on L2-normalised vectors)
   Pull 4× k candidates (wider pool before re-ranking)

Step 4 — Multi-signal re-ranking per candidate posting:
   ┌──────────────────────┬────────┐
   │ Signal               │ Weight │
   ├──────────────────────┼────────┤
   │ Skill overlap        │  50%   │ matched / total required skills
   │ Semantic (FAISS)     │  20%   │ cosine similarity of embeddings
   │ Education match      │  15%   │ degree level vs. posting requirement
   │ Location / mode      │  15%   │ city match; Remote always scores 1.0
   └──────────────────────┴────────┘

Step 5 — Sort by composite score, return top k (default 5, max 20)
   Each result includes: match_label, match_percentage, matched_skills,
   missing_skills, skill_score, semantic_score, education_score, location_score

Step 6 — Groq LLM summary (best-effort, skipped if no API key)
   2-3 sentence natural-language overview of fit + 1-2 skill suggestions
```

**Match labels:**

| Score | Label |
|---|---|
| ≥ 85% | 🟢 Perfect Match |
| ≥ 65% | 🔵 Strong Match |
| ≥ 40% | 🟡 Partial Match |
| < 40% | 🔴 Weak Match |

---

### 4. FAISS Index — Build Once, Query Fast

The vector index is **pre-built** (not rebuilt per request):

```
python build_index.py
  │
  ├── Read app/data/internships.json  (~100+ synthetic postings)
  ├── Embed each posting with all-MiniLM-L6-v2
  │     First run: downloads ~90 MB model → ~/.cache/huggingface
  ├── Build FAISS IndexFlatIP (cosine, exact search)
  └── Save to app/data/faiss_internship_index/
        ├── index.faiss    (binary vectors)
        └── postings.pkl   (original posting dicts)

At request time:
  └── Index loaded once per process, then cached in memory
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **API Framework** | FastAPI | High-performance async REST API |
| **Frontend** | Streamlit | Multi-page interactive UI with dark glassmorphism design |
| **Database** | PostgreSQL | Persistent storage for users, tokens, and resumes |
| **ORM** | SQLAlchemy 2.0 | Type-safe DB access; JSONB columns for parsed resume fields |
| **Auth** | JWT (HS256) + bcrypt | Access/refresh token pair with rotation and revocation |
| **File Parsing** | PyMuPDF, python-docx | Text extraction from PDF and DOCX resumes |
| **LLM (parsing)** | Groq API — `llama-3.3-70b-versatile` | Contextual resume field extraction |
| **LLM (summary)** | Groq API — configurable model | Natural-language match summaries |
| **Embeddings** | HuggingFace `all-MiniLM-L6-v2` | 384-dim sentence embeddings; runs on CPU, no API key |
| **Vector Search** | FAISS (`IndexFlatIP`) | Exact cosine similarity search over internship postings |
| **Settings** | pydantic-settings | Typed, validated config loaded from `.env` |
| **Language** | Python 3.10+ | |

---

## Project Structure

```
milestone_assignment_2/
├── build_index.py              # One-off: embed internship postings → FAISS index
├── .env.example                # Environment variable template
├── .env                        # Your actual secrets (git-ignored)
├── test_resume.pdf             # Sample resume for manual testing
│
├── app/                        # FastAPI backend
│   ├── main.py                 # App entry point — mounts routers, creates DB tables
│   ├── config.py               # pydantic-settings: reads .env into typed Settings
│   ├── database.py             # SQLAlchemy engine + session factory
│   ├── models.py               # ORM models → PostgreSQL tables (users, refresh_tokens, resumes)
│   ├── schemas.py              # Pydantic schemas for request/response validation
│   ├── security.py             # bcrypt password hashing + JWT creation/decoding
│   ├── crud.py                 # DB query functions (Create / Read / Update / Delete)
│   ├── resume_parser.py        # Hybrid regex + Groq LLM resume parsing pipeline
│   ├── requirements.txt        # Python dependencies
│   │
│   ├── routers/
│   │   ├── auth.py             # /auth/* — register, login, refresh, logout, reset
│   │   ├── resume.py           # /resume/* — upload, list, download
│   │   └── internships.py      # /internships/ — catalog browse + RAG match
│   │
│   ├── services/
│   │   ├── internship_index.py # FAISS index build + search (MiniLM-L6-v2 embeddings)
│   │   └── internship_matcher.py # Multi-signal re-ranking agent
│   │
│   └── data/
│       ├── internships.json    # Synthetic internship catalog (~100+ postings)
│       └── faiss_internship_index/
│           ├── index.faiss     # Built by build_index.py
│           └── postings.pkl    # Serialised posting metadata
│
├── frontend/
│   └── streamlit_app.py        # 5-page Streamlit UI (dark glassmorphism design)
│
└── uploads/
    └── resumes/
        └── <user_id>/          # One folder per user; random filenames on disk
```

---

## Database Schema

| Table | Key Columns | Purpose |
|---|---|---|
| `users` | `id` (UUID), `email`, `hashed_password`, `reset_token` | Registered students |
| `refresh_tokens` | `token`, `expires_at`, `revoked` | Revocable JWT refresh tokens |
| `resumes` | `file_path`, `parsed_status`, `skills` (JSONB), `education` (JSONB), … | File metadata + all parsed fields |

JSONB columns (`skills`, `education`, `work_experience`, `projects`, etc.) store structured arrays/dicts — Postgres can query *into* them (e.g. `skills @> '["Python"]'`) without a separate table.

Tables are **auto-created on startup** via `Base.metadata.create_all()` — no manual SQL needed.

---

## API Endpoints

### Authentication (`/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create a new account |
| POST | `/auth/login` | — | Login → access + refresh tokens |
| GET | `/auth/me` | ✅ | Get current user profile |
| POST | `/auth/refresh` | — | Exchange refresh token for new pair |
| POST | `/auth/logout` | — | Revoke a refresh token |
| POST | `/auth/forgot-password` | — | Request a password reset token |
| POST | `/auth/reset-password` | — | Reset password with token |
| POST | `/auth/change-password` | ✅ | Change password while logged in |

### Resume (`/resume`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/resume/upload` | ✅ | Upload a PDF/DOCX and trigger parsing |
| GET | `/resume/` | ✅ | List all resumes with parsed data |
| GET | `/resume/{id}/download` | ✅ | Download the original file |

### Internships (`/internships`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/internships/` | — | Browse full catalog (public) |
| GET | `/internships/match/{resume_id}?k=5` | ✅ | RAG match + re-rank + LLM summary |

---

## Setup & Running

### Prerequisites

- Python 3.10+
- PostgreSQL installed and running

### 1. Install Dependencies

```bash
python -m venv myvenv
myvenv\Scripts\activate          # Windows
# source myvenv/bin/activate     # macOS/Linux
pip install -r app/requirements.txt
```

### 2. Create PostgreSQL Database

```sql
CREATE DATABASE ai_internship_agent;
```

### 3. Configure Environment Variables

Copy `.env.example` → `.env` and fill in your values:

```env
DATABASE_URL=postgresql+psycopg://postgres:yourpassword@localhost:5432/ai_internship_agent
SECRET_KEY=your-random-secret-key-at-least-32-chars

# Optional — disabling leaves regex-only parsing active
GROQ_API_KEY=your-groq-api-key
```

### 4. Build the FAISS Index (one-off, re-run when internships.json changes)

```bash
python build_index.py
# First run: downloads ~90 MB embedding model (cached after that)
```

### 5. Start the API Server

```bash
uvicorn app.main:app --reload
# Interactive docs: http://127.0.0.1:8000/docs
```

### 6. Start the Streamlit Frontend

```bash
streamlit run frontend/streamlit_app.py
# Opens in browser: http://localhost:8501
```

---

## Streamlit UI — Pages

| Page | Description |
|---|---|
| 🔐 **Login / Register** | Create account or sign in; tokens stored in session state |
| 📄 **My Resumes** | Upload PDF/DOCX; view parsed fields (skills, education, experience); download original |
| 🎯 **Find Internships** | Select a resume, choose k (1–20), run RAG match; see score breakdown and Groq summary |
| 🔍 **Browse Catalog** | Paginated view of all postings; filter by domain, location, mode |
| 🧪 **Test Scenarios** | Pre-built demo flows for quick evaluation |

---

## Sample API Response — Internship Match

```json
{
  "resume_id": "a1b2c3d4-...",
  "query_skills": "Python, FastAPI, PostgreSQL, Docker",
  "summary": "The student's backend stack aligns strongly with 3 of the 5 matches. Learning React or TypeScript would open up 40% more full-stack roles in this catalog.",
  "results": [
    {
      "role_title": "Backend Developer Intern",
      "company": "TechCorp",
      "domain": "Backend Engineering",
      "location": "Bangalore, India",
      "mode": "Hybrid",
      "required_skills": ["Python", "FastAPI", "PostgreSQL"],
      "match_percentage": 87.3,
      "match_label": "Perfect Match",
      "skill_score": 1.0,
      "semantic_score": 0.82,
      "education_score": 1.0,
      "location_score": 1.0,
      "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
      "missing_skills": []
    }
  ]
}
```

---

## Sample Parsed Resume Output

```json
{
  "id": "a1b2c3d4-...",
  "original_filename": "resume.pdf",
  "parsed_status": "parsed",
  "full_name": "Naren Kumar",
  "email": "naren@example.com",
  "phone": "+919876543210",
  "linkedin_url": "linkedin.com/in/narenkumarchandran",
  "github_url": "github.com/narenkumarchandran",
  "professional_summary": "Final-year CSE student focused on full-stack development.",
  "skills": ["Python", "FastAPI", "React", "PostgreSQL"],
  "education": [{"institution": "Shiv Nadar University Chennai", "degree": "B.Tech CSE (IoT)"}],
  "work_experience": [{"title": "SDE Intern", "company": "Infosys", "description": "Built REST APIs"}],
  "projects": [{"name": "ReWear", "description": "Second-hand clothing marketplace", "tech_stack": "React, Node.js"}],
  "certifications": [],
  "achievements": []
}
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Regex + LLM hybrid** | Regex is faster and more reliable for fixed-format fields (email, phone). LLM handles free-form fields (skills, experience) that vary wildly across resumes. |
| **FAISS pre-built index** | Embedding 100+ postings at every request would be too slow. Pre-building and caching means vector search takes milliseconds. |
| **4× candidate pool before re-ranking** | Pure cosine similarity is a weak final signal. A wider FAISS pool ensures good candidates aren't discarded before the more meaningful skill/education/location scores run. |
| **Skills weighted 50%** | Skill match is the primary hiring signal for internships; semantic + education + location are supporting signals. |
| **JSONB for parsed fields** | Resume structure is open-ended. JSONB avoids schema churn as parsed fields evolve, while still being queryable in Postgres. |
| **UUID primary keys** | Unguessable IDs prevent enumeration attacks on resume/user endpoints. |
| **Refresh token DB storage** | JWTs can't be revoked client-side once issued. DB storage enables logout and rotation. |

---

## License

This project is licensed under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 Naren Kumar Chandran

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
