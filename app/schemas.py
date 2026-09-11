# ---------------------------------------------------------------------------
# PYDANTIC SCHEMAS = REQUEST / RESPONSE SHAPES (NOT database tables!)
# ---------------------------------------------------------------------------
# These classes are easy to confuse with the ORM models in models.py, but
# they serve a different purpose:
#   - models.py   -> defines what's stored IN THE DATABASE (columns, tables)
#   - schemas.py  -> defines what's allowed IN/OUT of the API (JSON shape)
#
# Example: UserOut deliberately leaves out `hashed_password` — even though
# the User *model* has that column, we never want to send it back to a
# client. FastAPI uses `response_model=schemas.UserOut` in the routes to
# enforce this automatically.
# ---------------------------------------------------------------------------

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, ConfigDict, Field


class UserCreate(BaseModel):
    """Body of POST /auth/register. FastAPI validates this before our code runs
    (e.g. rejects a request with password shorter than 8 chars automatically)."""

    full_name: str = Field(min_length=1, max_length=150)
    email: EmailStr  # rejects malformed emails automatically
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    """What we send back after register / in GET /auth/me. No password field."""

    # from_attributes=True lets us build this directly from a SQLAlchemy
    # User object (schemas.UserOut.model_validate(user_row)) instead of a dict.
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: EmailStr
    is_active: bool
    created_at: datetime


class LoginRequest(BaseModel):
    """Body of POST /auth/login."""

    email: EmailStr
    password: str


class TokenPair(BaseModel):
    """Response of /login and /refresh: the two JWTs the client should store."""

    access_token: str   # short-lived, sent with every authenticated request
    refresh_token: str  # long-lived, used only to obtain a new access_token
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Body of POST /auth/refresh and POST /auth/logout."""

    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    """Body of POST /auth/forgot-password."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Body of POST /auth/reset-password."""

    reset_token: str
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    """Body of POST /auth/change-password. Requires the CURRENT password
    as well — unlike reset-password, which is for users who are locked out
    and can't supply it."""

    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ResumeOut(BaseModel):
    """What we send back after a resume upload / when listing a student's
    resumes. Deliberately leaves out `file_path` — that's a server-side
    filesystem detail, not something a client needs or should see.

    The parsed_* fields below mirror app/resume_parser.py's output: regex
    fields (email, phone, linkedin_url, github_url) plus LLM-extracted,
    variable-shape sections (skills, education, work_experience, ...).
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    original_filename: str
    content_type: str
    file_size: int
    uploaded_at: datetime

    parsed_status: str
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    professional_summary: str | None = None
    skills: Any = None
    technical_skills: Any = None
    soft_skills: Any = None
    education: Any = None
    work_experience: Any = None
    projects: Any = None
    certifications: Any = None
    internships: Any = None
    languages: Any = None
    achievements: Any = None
    other_info: Any = None


# ---------------------------------------------------------------------------
# INTERNSHIP SCHEMAS — used by /internships/ routes
# ---------------------------------------------------------------------------


class InternshipPosting(BaseModel):
    """One synthetic internship posting, as stored in
    app/data/internships.json and indexed in FAISS (see
    app/services/internship_index.py)."""

    id: str
    company: str
    role_title: str
    domain: str
    location: str
    mode: str
    duration_weeks: int
    stipend_inr_per_month: int
    min_education: str
    required_skills: list[str]
    preferred_skills: list[str]
    description: str


class InternshipMatch(InternshipPosting):
    """A posting returned by the matching endpoint, with the weighted
    composite match score and a breakdown of what it's made of (see
    app/services/internship_matcher.py) plus the skill-gap detail."""

    # Composite 0-1 score: 0.5*skill + 0.2*semantic + 0.15*education + 0.15*location
    match_score: float
    match_percentage: float      # match_score × 100, for display
    match_label: str             # "Perfect Match" / "Strong Match" / "Partial Match" / "Weak Match"
    semantic_score: float        # FAISS-derived similarity
    skill_score: float           # matched skills / required skills
    education_score: float       # degree-level alignment
    location_score: float        # city / remote match
    matched_skills: list[str]    # resume skills present in required_skills
    missing_skills: list[str]    # required_skills absent from resume


class InternshipMatchResponse(BaseModel):
    """Response of GET /internships/match/{resume_id}."""

    resume_id: uuid.UUID
    query_skills: str | None       # the skills text used to build the embedding query
    results: list[InternshipMatch]
    summary: str | None = None     # optional Groq-generated summary of the match set


# ---------------------------------------------------------------------------
# CHATBOT SCHEMAS
# ---------------------------------------------------------------------------

class ChatMessageCreate(BaseModel):
    """Payload to send a message to the chatbot."""
    message: str

class ChatMessageResponse(BaseModel):
    """Response structure for a single chat message."""
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    message: str
    created_at: datetime

class ChatSessionResponse(BaseModel):
    """Response structure for a chat session, optionally including messages."""
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    messages: list[ChatMessageResponse] = []


# ---------------------------------------------------------------------------
# INTERVIEW AGENT SCHEMAS
# ---------------------------------------------------------------------------

class AgentChatMessageCreate(BaseModel):
    """Payload to send a message to the Interview Preparation Agent.
    Optionally includes a resume_id so the agent can use the candidate's
    parsed resume data as personalized context."""
    message: str
    resume_id: uuid.UUID | None = None


class AgentChatSessionCreate(BaseModel):
    """Optional body for creating an agent session pre-linked to a resume."""
    resume_id: uuid.UUID | None = None


# ---------------------------------------------------------------------------
# DOCUMENT Q&A SCHEMAS
# ---------------------------------------------------------------------------

class DocumentUploadResponse(BaseModel):
    """Response after successfully uploading and processing a document for Q&A."""
    doc_session_id: str
    filename: str
    chunk_count: int
    message: str


class DocQAMessageCreate(BaseModel):
    """Payload to ask a question about an uploaded document."""
    message: str


class DocQAMessageResponse(BaseModel):
    """Response from the document Q&A endpoint."""
    doc_session_id: str
    question: str
    answer: str
