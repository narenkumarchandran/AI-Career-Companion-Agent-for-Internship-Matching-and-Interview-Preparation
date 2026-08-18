# ---------------------------------------------------------------------------
# ORM MODELS = DATABASE TABLES
# ---------------------------------------------------------------------------
# Each class below is a Python object AND a Postgres table at the same time.
# SQLAlchemy's "ORM" (Object Relational Mapper) translates between the two:
#   User(full_name="Ana", email="a@x.com")   <-->   a row in the "users" table
#
# How it works, piece by piece (see the User class below as the example):
#   1. `class User(Base):`        -> inherits from Base (see database.py),
#                                    which registers this class as a table.
#   2. `__tablename__ = "users"`  -> the actual table name in Postgres.
#   3. Each `mapped_column(...)`  -> one column in that table.
#   4. `Mapped[str]`, `Mapped[bool]`, etc. -> the Python-side type; SQLAlchemy
#                                    infers/validates the matching Postgres type.
#   5. `relationship(...)`        -> NOT a real column. It's a convenience so
#                                    Python code can do `user.refresh_tokens`
#                                    instead of writing a manual JOIN query.
#
# Tables are only *created* in Postgres when Base.metadata.create_all() runs
# (see main.py) — defining the class here does not touch the database yet.
#
# Want to add a new table (e.g. StudentProfile)? See the "Adding a new model"
# section in README.md for the full step-by-step.
# ---------------------------------------------------------------------------

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    """The 'students' table for auth purposes. One row = one registered user."""

    __tablename__ = "users"

    # primary_key=True -> this column uniquely identifies each row.
    # We use a UUID instead of an auto-incrementing int so IDs are
    # unguessable and safe to expose in URLs/tokens.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    full_name: Mapped[str] = mapped_column(String(150), nullable=False)

    # unique=True -> Postgres rejects a second row with the same email.
    # index=True  -> makes lookups by email (login) fast.
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    # We NEVER store the raw password — only its bcrypt hash (see security.py).
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

 
    reset_token: Mapped[str | None] = mapped_column(String(512), nullable=True)

    
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    # One User can upload many Resumes over time (re-uploads, updated versions).
    resumes: Mapped[list["Resume"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    """Tracks issued refresh tokens so we can revoke/rotate them.

    Why store these in the DB at all, if the JWT itself is self-contained?
    Because a JWT can't be "cancelled" once issued — anyone holding it can
    use it until it expires. Keeping a row per token lets us mark it
    `revoked` on logout or rotation, closing that window.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ForeignKey -> links this row to a row in "users". ondelete="CASCADE"
    # tells Postgres to auto-delete a user's tokens if the user row is deleted.
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    token: Mapped[str] = mapped_column(String(512), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    # The reverse side of User.refresh_tokens -> lets us do token.user.email
    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class Resume(Base):
    """One row per resume file a student uploads.

    The actual PDF/DOC file lives on disk (see app/routers/resume.py for
    where and how it's saved) — this table just keeps a record of it:
    who uploaded it (user_id), what it's called, and where to find it
    (file_path). Storing the file path in the DB — instead of the file
    itself — keeps the database small and fast; the filesystem is better
    suited to storing large binary files.
    """

    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Links every resume back to exactly one user -> "which resume belongs
    # to which student" is answered by this single column.
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # The name the student's file had on their own computer (for display only).
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    # The random, collision-proof name we actually saved it as on disk
    # (see resume.py — we never trust/reuse the student's own filename here).
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    # Where the file lives on the server's filesystem.
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(nullable=False)  # bytes
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # -------------------------------------------------------------------
    # Parsed candidate data (see app/resume_parser.py for how this is
    # produced). Deterministic fields come from regex; everything with no
    # fixed shape (skills, education, work_experience, ...) comes from the
    # LLM pass and is stored as JSONB — Postgres can still query *into*
    # these columns (e.g. `skills @> '["Python"]'`) even though they hold
    # lists/dicts rather than a fixed set of columns.
    # -------------------------------------------------------------------
    parsed_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending / parsed / failed

    full_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    professional_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    skills: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    technical_skills: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    soft_skills: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    education: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    work_experience: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    projects: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    certifications: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    internships: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    languages: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    achievements: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    other_info: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)

    user: Mapped["User"] = relationship(back_populates="resumes")
