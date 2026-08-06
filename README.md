# AI Internship Assistant

An AI-powered backend API designed to help students manage their internship journey — from uploading and parsing resumes to tracking applications and preparing for interviews.

---

## What This Project Does

The AI Internship Assistant is a backend service built with **FastAPI** and **PostgreSQL** that provides:

- **User Authentication** — Secure registration and login system with JWT-based access and refresh tokens, password reset, and session management.
- **Resume Upload & Storage** — Students can upload their resumes (PDF or DOCX, up to 5 MB). Files are stored securely on disk, organized per user, with metadata tracked in the database.
- **AI-Powered Resume Parsing** — Every uploaded resume is automatically analyzed using a **hybrid regex + LLM pipeline**. Structured contact info (email, phone, LinkedIn, GitHub) is extracted via regex for accuracy, while contextual fields (skills, education, work experience, projects, certifications) are extracted using the **Groq API** with the `llama-3.3-70b-versatile` model.

---

## Planned Modules

This project is designed to grow into a full career assistant platform. The current version covers the foundation (auth + resume management). Future modules include:

1. **Student Profile Management** — Detailed academic and career profiles
2. **Internship Knowledge Base & RAG Indexing** — Searchable internship database with retrieval-augmented generation
3. **Job-Resume Matching & Compatibility Scoring** — AI agent that scores how well a resume matches a job description
4. **Skill Gap Analysis & Recommendations** — Identifies missing skills and suggests learning resources
5. **Resume & Cover Letter Customization** — AI-powered tailoring of resumes for specific roles
6. **Interview Preparation & Question Generation** — Generates role-specific interview questions and prep material
7. **Application Tracking & Management** — Track application status across multiple internships
8. **Conversational Career Assistant** — Chat-based interface for career guidance

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | FastAPI |
| **Database** | PostgreSQL |
| **ORM** | SQLAlchemy |
| **Authentication** | JWT (access + refresh tokens) with bcrypt password hashing |
| **Resume Parsing** | PyMuPDF (PDF), python-docx (DOCX) for text extraction |
| **AI / LLM** | Groq API (`llama-3.3-70b-versatile`) for contextual parsing |
| **Language** | Python 3.10+ |

---

## Project Structure

```
Assignment_3/
├── .env.example         # Environment variable template (copy to .env)
├── README.md            # This file
├── app/
│   ├── main.py          # App entrypoint — creates FastAPI app, mounts routers, creates DB tables
│   ├── config.py        # Reads .env into a typed Settings object
│   ├── database.py      # SQLAlchemy engine and session setup
│   ├── models.py        # ORM models (users, refresh_tokens, resumes)
│   ├── schemas.py       # Pydantic schemas for API request/response validation
│   ├── security.py      # Password hashing (bcrypt) and JWT creation/decoding
│   ├── crud.py          # Database query functions (Create, Read, Update, Delete)
│   ├── resume_parser.py # Hybrid regex + LLM resume parsing pipeline
│   ├── requirements.txt # Python dependencies
│   └── routers/
│       ├── auth.py      # Authentication endpoints (/auth/register, /login, etc.)
│       └── resume.py    # Resume endpoints (/resume/upload, list, download)
└── uploads/             # Uploaded resume files (auto-created, not tracked in git)
```

---

## How It Works

### Authentication Flow
1. A student **registers** with their name, email, and password (password is hashed with bcrypt before storage).
2. On **login**, the server verifies credentials and issues two JWT tokens:
   - **Access token** (short-lived, 30 min) — used on every API request to prove identity.
   - **Refresh token** (long-lived, 7 days) — used only to get a new access token without re-entering the password.
3. The refresh token is stored in the database so it can be **revoked** on logout or if compromised.
4. Token **rotation** is enforced — every time a refresh token is used, it's revoked and a brand new pair is issued.

### Resume Upload & Parsing Flow
1. The student uploads a `.pdf` or `.docx` file via the protected `/resume/upload` endpoint.
2. The file is saved to disk under `uploads/resumes/<user_id>/<random_name>` — one folder per user to keep things organized and prevent filename collisions.
3. The **resume parser** runs automatically:
   - **Regex pass** — extracts email, phone number, LinkedIn URL, and GitHub URL (these have fixed patterns, so regex is faster and more reliable here).
   - **LLM pass** — sends the resume text to Groq's LLM to extract skills, education, work experience, projects, certifications, achievements, and more (these vary wildly across resumes, so an AI model handles them better).
   - **Merge** — regex results take priority for contact info; LLM results fill in everything else.
4. The parsed data is stored in the database alongside the file metadata.
5. If parsing fails for any reason, the upload still succeeds — the file is saved and marked with `parsed_status: "failed"` so it can be retried later.

### Security Design
- Passwords are never stored in plain text — only bcrypt hashes.
- JWT tokens are signed with a secret key and validated on every protected request.
- Resume files are stored with random filenames to prevent path traversal attacks.
- Each student can only access their own resumes — ownership is enforced on every request.
- The API never reveals whether an email is registered (to prevent account enumeration).

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Stores registered students — name, email, hashed password, reset token |
| `refresh_tokens` | Tracks issued refresh tokens for revocation and rotation |
| `resumes` | Stores resume metadata (filename, path, size) and all parsed/extracted fields |

Tables are **auto-created** on app startup using SQLAlchemy — no manual SQL required.

---

## API Endpoints

### Authentication (`/auth`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create a new account |
| POST | `/auth/login` | Login and get access + refresh tokens |
| GET | `/auth/me` | Get current user info (protected) |
| POST | `/auth/refresh` | Exchange refresh token for new token pair |
| POST | `/auth/logout` | Revoke a refresh token |
| POST | `/auth/forgot-password` | Request a password reset token |
| POST | `/auth/reset-password` | Reset password using reset token |
| POST | `/auth/change-password` | Change password while logged in (protected) |

### Resume (`/resume`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/resume/upload` | Upload and parse a resume (protected) |
| GET | `/resume/` | List all uploaded resumes with parsed data (protected) |
| GET | `/resume/{id}/download` | Download the original resume file (protected) |

---

## Setup & Running

### Prerequisites
- Python 3.10+
- PostgreSQL installed and running

### Steps

1. **Create a virtual environment and install dependencies:**
   ```
   python -m venv myvenv
   myvenv\Scripts\activate
   pip install -r app\requirements.txt
   ```

2. **Create the PostgreSQL database:**
   ```
   CREATE DATABASE ai_internship_agent;
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your actual values:
   ```
   DATABASE_URL=postgresql+psycopg://postgres:yourpassword@localhost:5432/ai_internship_agent
   SECRET_KEY=your-random-secret-key
   GROQ_API_KEY=your-groq-api-key
   ```

4. **Run the server:**
   ```
   uvicorn app.main:app --reload
   ```

5. **Test the API:**
   Open `http://127.0.0.1:8000/docs` for the interactive Swagger UI.

---

## Sample Parsed Resume Output

```json
{
  "id": "...",
  "original_filename": "resume.pdf",
  "parsed_status": "parsed",
  "full_name": "Naren Kumar",
  "email": "naren@example.com",
  "phone": "+919876543210",
  "linkedin_url": "linkedin.com/in/narenkumarchandran",
  "github_url": "github.com/narenkumarchandran",
  "professional_summary": "Final-year CSE student focused on full-stack development.",
  "skills": ["Python", "React", "MongoDB"],
  "education": [{"institution": "Shiv Nadar University Chennai", "degree": "B.Tech CSE (IoT)"}],
  "projects": [{"name": "ReWear", "description": "Second-hand clothing marketplace"}],
  "certifications": [],
  "achievements": []
}
```
