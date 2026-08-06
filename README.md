# Internship Assistant API

A FastAPI + SQLAlchemy + PostgreSQL backend. This is the foundation (Register
+ Login + JWT auth) for a larger project with these planned modules:

1. Student Profile and Resume Management
2. Resume Parsing and Skill Extraction
3. Internship Knowledge Base and RAG Indexing
4. Job-Resume Matching and Compatibility Scoring Agent
5. Skill Gap Analysis and Recommendation Agent
6. Resume and Cover Letter Customization Agent
7. Interview Preparation and Question Generation Agent
8. Application Tracking and Management
9. Conversational Career Assistant

Right now, only the auth foundation (Module 0, so to speak) is built:
**register → login → access token → refresh token**. Every future module
will hang off the `users` table built here.

---

## 1. Prerequisites

- Python 3.10+
- PostgreSQL installed and running locally (or accessible remotely)
- A Python virtual environment (this repo already has one at `myvenv/`)

---

## 2. Setup

### 2.1 Activate the virtual environment

```powershell
myvenv\Scripts\activate
```

### 2.2 Install dependencies

```powershell
pip install -r requirements.txt
```

### 2.3 Create the PostgreSQL database

You need a **database** to exist before the app can create tables inside it.
Two ways to do this:

**Option A — using `psql` (command line):**

```powershell
psql -U postgres
```

Then inside the `psql` prompt:

```sql
CREATE DATABASE ai_internship_agent;
\q
```

**Option B — using pgAdmin (GUI):** right-click "Databases" → *Create* →
*Database*, name it `ai_internship_agent`.

> The name must match the database name in your `DATABASE_URL` below.

### 2.4 Configure `.env`

The `.env` file at the project root holds secrets and connection info —
**never commit real secrets to git**. It should look like this:

```env
DATABASE_URL=postgresql+psycopg://<username>:<password>@localhost:5432/ai_internship_agent
SECRET_KEY=some-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
RESET_TOKEN_EXPIRE_MINUTES=15
GROQ_API_KEY=your-groq-api-key
```

> `GROQ_API_KEY` is required now that resume parsing (see section 10 below)
> calls the Groq LLM. `app/config.py`'s `Settings` class will refuse to
> start the app if it's missing from `.env`, the same way it already does
> for `SECRET_KEY`.

- `DATABASE_URL` format: `postgresql+psycopg://USER:PASSWORD@HOST:PORT/DBNAME`
- `SECRET_KEY` signs the JWTs — generate a real one for anything beyond
  local learning, e.g.:
  ```powershell
  python -c "import secrets; print(secrets.token_hex(32))"
  ```

### 2.5 Run the server

```powershell
myvenv\Scripts\uvicorn app.main:app --reload
```

On startup, the app automatically creates any missing tables in your
database (see `Base.metadata.create_all()` in `app/main.py`) — **you do not
need to write `CREATE TABLE` SQL by hand**, SQLAlchemy generates it from the
Python model classes in `app/models.py`.

Open **http://127.0.0.1:8000/docs** for the interactive Swagger UI, where
you can try every endpoint from the browser.

---

## 3. Project structure

```
app/
├── main.py           # creates the FastAPI app, mounts routers, creates DB tables
├── config.py          # reads .env into a typed Settings object
├── database.py         # SQLAlchemy engine/session setup — the DB connection
├── models.py           # ORM models = your database tables
├── schemas.py         # Pydantic schemas = API request/response JSON shapes
├── security.py         # password hashing (bcrypt) + JWT creation/decoding
├── crud.py             # all direct database queries (Create/Read/Update/Delete)
└── routers/
    └── auth.py         # /auth/register, /login, /refresh, /logout, /me
```

**Why models.py and schemas.py are separate:** a *model* is what's stored in
Postgres (e.g. `User` has a `hashed_password` column). A *schema* is what's
allowed over the API (e.g. `UserOut` intentionally has no password field, so
it never leaks in a response). Keeping them separate is what stops internal
DB fields from accidentally becoming public API fields.

Every file above has inline comments explaining what each piece does — read
them alongside this README.

---

## 4. How tables get created (SQLAlchemy models, in plain terms)

You never hand-write `CREATE TABLE` SQL in this project. Instead:

1. You define a Python class in `app/models.py` that inherits from `Base`.
2. Each attribute on the class (using `mapped_column(...)`) becomes one
   column in the table.
3. When the app starts, `Base.metadata.create_all(bind=engine)` in
   `app/main.py` looks at every class that inherits from `Base` and creates
   the matching table in Postgres **if it doesn't already exist**.

Example — the existing `User` model:

```python
class User(Base):
    __tablename__ = "users"          # table name in Postgres

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=...)
```

This produces (conceptually) the same result as:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ
);
```

> **Note on `create_all()`:** it only *adds* missing tables — it will never
> alter an existing table's columns or drop data. Once this project has real
> data in it, changing a model's columns requires a migration tool (e.g.
> **Alembic**) instead of relying on `create_all()`. That's out of scope for
> this learning stage but worth knowing for later.

---

## 5. Adding a new model/table — step by step

Say you're starting **Module 1 (Student Profile)** and want a
`StudentProfile` table linked to `User`. Here's the full workflow:

### Step 1 — Define the model in `app/models.py`

```python
class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # One-to-one link back to the owning user.
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    college: Mapped[str] = mapped_column(String(150), nullable=True)
    branch: Mapped[str] = mapped_column(String(100), nullable=True)
    graduation_year: Mapped[int] = mapped_column(nullable=True)

    user: Mapped["User"] = relationship(back_populates="profile")
```

And add the matching reverse relationship on `User`:

```python
profile: Mapped["StudentProfile"] = relationship(back_populates="user", uselist=False)
```

### Step 2 — Define request/response schemas in `app/schemas.py`

```python
class StudentProfileCreate(BaseModel):
    college: str | None = None
    branch: str | None = None
    graduation_year: int | None = None


class StudentProfileOut(StudentProfileCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
```

### Step 3 — Add query functions in `app/crud.py`

```python
def create_student_profile(db: Session, user_id: uuid.UUID, data: schemas.StudentProfileCreate):
    profile = models.StudentProfile(user_id=user_id, **data.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile
```

### Step 4 — Add routes (new file, e.g. `app/routers/profile.py`)

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app import crud, schemas
from app.database import get_db
from app.routers.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/profile", tags=["profile"])

@router.post("/", response_model=schemas.StudentProfileOut)
def create_profile(
    payload: schemas.StudentProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # requires a valid access token
):
    return crud.create_student_profile(db, current_user.id, payload)
```

### Step 5 — Register the router in `app/main.py`

```python
from app.routers import auth, profile
...
app.include_router(profile.router)
```

### Step 6 — Restart the server

```powershell
myvenv\Scripts\uvicorn app.main:app --reload
```

`Base.metadata.create_all()` runs again on startup and creates the new
`student_profiles` table automatically — no manual SQL needed.

That's the repeatable pattern for every future module in this list:
**model → schema → crud function → route → register router.**

---

## 6. API reference

Base URL when running locally: `http://127.0.0.1:8000`

### `POST /auth/register`

Create a new account.

```powershell
curl -X POST http://127.0.0.1:8000/auth/register `
  -H "Content-Type: application/json" `
  -d '{"full_name":"Test User","email":"test@example.com","password":"password123"}'
```

Response `201`:
```json
{"id": "...", "full_name": "Test User", "email": "test@example.com", "is_active": true, "created_at": "..."}
```

### `POST /auth/login`

Exchange email + password for an access/refresh token pair.

```powershell
curl -X POST http://127.0.0.1:8000/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"password123"}'
```

Response `200`:
```json
{"access_token": "...", "refresh_token": "...", "token_type": "bearer"}
```

### `GET /auth/me` — example of a protected route

Requires the `access_token` from login, sent as a Bearer token.

```powershell
curl http://127.0.0.1:8000/auth/me -H "Authorization: Bearer <access_token>"
```

### `POST /auth/refresh`

Trade a still-valid `refresh_token` for a brand-new access/refresh pair
(rotation — the old refresh token is revoked and can't be reused).

```powershell
curl -X POST http://127.0.0.1:8000/auth/refresh `
  -H "Content-Type: application/json" `
  -d '{"refresh_token":"<refresh_token>"}'
```

### `POST /auth/logout`

Revokes a refresh token (e.g. on user logout).

```powershell
curl -X POST http://127.0.0.1:8000/auth/logout `
  -H "Content-Type: application/json" `
  -d '{"refresh_token":"<refresh_token>"}'
```

### `POST /resume/upload` — protected

Upload a resume file (`.pdf`, `.doc`, or `.docx`, max 5 MB). Requires an
access token — the file is automatically linked to whichever user the token
belongs to.

```powershell
curl -X POST http://127.0.0.1:8000/resume/upload `
  -H "Authorization: Bearer <access_token>" `
  -F "file=@C:\path\to\resume.pdf"
```

Response `201`:
```json
{"id": "...", "user_id": "...", "original_filename": "resume.pdf", "content_type": "application/pdf", "file_size": 48213, "uploaded_at": "..."}
```

### `GET /resume/` — protected

List every resume the logged-in student has uploaded.

```powershell
curl http://127.0.0.1:8000/resume/ -H "Authorization: Bearer <access_token>"
```

### `GET /resume/{resume_id}/download` — protected

Download a resume file back. Returns `404` if the resume doesn't belong to
the logged-in user, even if that `resume_id` exists for someone else — this
is what actually enforces "your resume belongs only to you", not just the
foreign key.

```powershell
curl http://127.0.0.1:8000/resume/<resume_id>/download `
  -H "Authorization: Bearer <access_token>" -o downloaded_resume.pdf
```

---

## 7. How resume files are stored

Two things happen on every upload, and it's worth understanding both:

1. **The actual file bytes** are written to disk under:

   ```text
   uploads/resumes/<user_id>/<random_name>.<ext>
   ```

   One folder per user keeps files organized and guarantees two students
   uploading `resume.pdf` never overwrite each other. The filename on disk
   is always randomly generated — the student's original filename is never
   trusted for the actual file path (a filename like `../../secrets.txt`
   could otherwise be used to write outside the intended folder).

2. **A metadata row** is inserted into the `resumes` table (see
   `app/models.py`) recording: which user uploaded it (`user_id`), the
   original filename (for display), the generated on-disk path
   (`file_path`), content type, size, and timestamp.

This is a common pattern for *any* file upload feature: **big binary files
go on disk (or cloud storage like S3 later), small structured metadata goes
in the database.** Storing multi-MB files as database rows would make the
database slow and expensive to back up.

The `user_id` foreign key is what answers "which resume belongs to which
student" — and `/resume/{id}/download` proves why it matters: it's checked
on every request so one student can never download another's resume just by
guessing an ID.

---

## 8. Why two tokens (access + refresh)?

| Token | Lifetime | Purpose | Sent on |
|---|---|---|---|
| `access_token` | short (30 min default) | proves "who you are" for protected routes | every API request, as `Authorization: Bearer <token>` |
| `refresh_token` | long (7 days default) | only used to get a *new* access token | only to `POST /auth/refresh` |

If an access token leaks, the damage window is small (it expires soon). The
refresh token is kept in the database (`refresh_tokens` table) precisely so
it *can* be revoked early — on logout, or automatically whenever it's used
once (rotation), even though the JWT itself would otherwise still look
"valid" until its expiry date.

---

## 9. Current database schema

| Table | Purpose |
|---|---|
| `users` | one row per registered student/user (now also holds `reset_token` for forgot/reset-password) |
| `refresh_tokens` | one row per issued refresh token, for revocation/rotation |
| `resumes` | one row per uploaded resume file (metadata + disk path), **plus** all parsed candidate fields (see section 10) |

More tables (one per module above) will be added following the pattern in
section 5.

---

## 10. Password management (forgot / reset / change)

Three endpoints were added on top of the original register/login/refresh/
logout foundation:

### `POST /auth/forgot-password`

```json
{ "email": "test@example.com" }
```

Always returns `200` with the same message whether or not the email is
registered — this prevents the endpoint being used to check which emails
have accounts. A short-lived (`RESET_TOKEN_EXPIRE_MINUTES`, default 15)
JWT is generated via `security.create_reset_token()` and stored on the
user's `reset_token` column via `crud.set_reset_token()`.

```json
{
  "message": "If that email is registered, a reset link has been sent.",
  "reset_token_for_testing": "eyJhbGciOi..."
}
```

> `reset_token_for_testing` exists only because no email service is wired
> up yet — in a real deployment this token would be emailed, never
> returned in the response. Remove that key once email sending exists.

### `POST /auth/reset-password`

```json
{ "reset_token": "eyJhbGciOi...", "new_password": "NewPassw0rd1" }
```

Validates the token's signature, expiry, and `type == "reset"` claim,
then checks it matches the *latest* token stored on `user.reset_token`
(rejecting older/reused tokens — a new forgot-password request silently
invalidates any earlier one). On success, the password is updated and
`reset_token` is cleared, making the token single-use even though the
JWT itself would otherwise remain "valid" until its expiry.

### `POST /auth/change-password` — protected

```json
{ "current_password": "OldPass1", "new_password": "NewPass1" }
```

Requires a valid access token (`Depends(get_current_user)`) *and* the
correct current password — this is the "I know my password but want to
update it" flow, as opposed to reset-password's "I've forgotten it"
flow.

---

## 11. Resume parsing (`app/resume_parser.py`)

`POST /resume/upload` now does more than save the file: right after the
file is written to disk, `resume_parser.parse_resume(file_path)` runs a
**hybrid regex + LLM pipeline**:

1. **Text extraction** — PyMuPDF for `.pdf`, `python-docx` for `.doc`/`.docx`.
2. **Regex pass** — pulls email, phone, LinkedIn URL, GitHub URL. These have
   a fixed shape regardless of resume layout, so regex is faster and can't
   hallucinate here.
3. **LLM pass** (Groq, `llama-3.3-70b-versatile`, `temperature=0`) — pulls
   everything with no fixed shape: full name (as a fallback if the regex
   name heuristic misses), address, professional summary, skills,
   education, work experience, projects, certifications, internships,
   languages, achievements, and a catch-all `other_info`.
4. **Merge** — regex wins for the deterministic fields; the LLM fills in
   the rest. The combined dict is passed straight into
   `crud.create_resume(..., parsed_data=parsed_data)`.

If parsing throws (e.g. a corrupt file, or the LLM returns non-JSON), the
upload doesn't fail — the file is still saved and the `resumes` row is
still created, just with `parsed_status = "failed"` and empty extracted
fields, so the client can retry parsing later rather than losing the
upload entirely.

`GET /resume/` now returns the parsed fields alongside the existing file
metadata:

```json
{
  "id": "...",
  "user_id": "...",
  "original_filename": "resume.pdf",
  "content_type": "application/pdf",
  "file_size": 48213,
  "uploaded_at": "...",
  "parsed_status": "parsed",
  "full_name": "Naren Kumar",
  "email": "naren@example.com",
  "phone": "+919876543210",
  "linkedin_url": "linkedin.com/in/narenkumarchandran",
  "github_url": "github.com/narenkumarchandran",
  "professional_summary": "Final-year CSE student focused on full-stack development.",
  "skills": ["Python", "React", "MongoDB"],
  "education": [{ "institution": "Shiv Nadar University Chennai", "degree": "B.Tech CSE (IoT)" }],
  "projects": [{ "name": "ReWear", "description": "Second-hand clothing marketplace" }],
  "certifications": [],
  "achievements": []
}
```
