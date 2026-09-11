# ---------------------------------------------------------------------------
# CRUD = Create, Read, Update, Delete — all direct database queries live here.
# ---------------------------------------------------------------------------
# Why not just write db.query(...) inline inside the route functions?
# Keeping queries in one place makes them reusable and easy to find/test,
# and keeps routers/auth.py focused on request/response handling, not SQL.
# ---------------------------------------------------------------------------

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app import models, security


def get_user_by_email(db: Session, email: str) -> models.User | None:
    """SELECT * FROM users WHERE email = :email LIMIT 1"""
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_id(db: Session, user_id: uuid.UUID) -> models.User | None:
    return db.query(models.User).filter(models.User.id == user_id).first()


def create_user(db: Session, full_name: str, email: str, password: str) -> models.User:
    """Hashes the password, then INSERTs a new row into `users`."""
    user = models.User(
        full_name=full_name,
        email=email,
        hashed_password=security.hash_password(password),
    )
    db.add(user)      # stage the new row
    db.commit()       # write it to Postgres
    db.refresh(user)  # pull back DB-generated fields (id, created_at)
    return user


def set_reset_token(db: Session, user: models.User, token: str | None) -> None:
    """Stores the latest reset token issued for this user (or clears it,
    when called with token=None after a successful reset). Overwriting
    on each forgot-password request means only the most recently
    requested link is ever valid — an older one stops working silently."""
    user.reset_token = token
    db.commit()


def update_password(db: Session, user: models.User, new_hashed_password: str) -> None:
    """Used by both change-password (current password known) and
    reset-password (current password unknown, verified via token instead)."""
    user.hashed_password = new_hashed_password
    db.commit()


def store_refresh_token(db: Session, user_id: uuid.UUID, token: str, expires_at: datetime) -> models.RefreshToken:
    """Called every time we issue a refresh token, so it can later be
    looked up / revoked (see get_valid_refresh_token and revoke_refresh_token)."""
    db_token = models.RefreshToken(user_id=user_id, token=token, expires_at=expires_at)
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token


def get_valid_refresh_token(db: Session, token: str) -> models.RefreshToken | None:
    """Returns the token row only if it exists, hasn't been revoked, and
    hasn't expired — otherwise None, meaning "reject this refresh attempt"."""
    db_token = db.query(models.RefreshToken).filter(models.RefreshToken.token == token).first()
    if db_token is None or db_token.revoked:
        return None
    if db_token.expires_at < datetime.now(timezone.utc):
        return None
    return db_token


def revoke_refresh_token(db: Session, db_token: models.RefreshToken) -> None:
    """Marks a token unusable. Used on logout, and on every /refresh call
    (old token revoked, brand-new pair issued) — this is "token rotation"."""
    db_token.revoked = True
    db.commit()


def create_resume(
    db: Session,
    user_id: uuid.UUID,
    original_filename: str,
    stored_filename: str,
    file_path: str,
    content_type: str,
    file_size: int,
    parsed_data: dict | None = None,
    parsed_status: str | None = None,
) -> models.Resume:
    """INSERTs a row recording an already-saved-to-disk resume file, plus
    (if provided) the structured data extracted by app/resume_parser.py.
    The actual file write and parsing both happen in the route
    (app/routers/resume.py) before this is called — this function only
    persists the results."""
    parsed_data = parsed_data or {}

    resume = models.Resume(
        user_id=user_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_path=file_path,
        content_type=content_type,
        file_size=file_size,
        parsed_status=parsed_status or ("parsed" if parsed_data else "pending"),
        full_name=parsed_data.get("full_name"),
        email=parsed_data.get("email"),
        phone=parsed_data.get("phone"),
        address=parsed_data.get("address"),
        linkedin_url=parsed_data.get("linkedin_url"),
        github_url=parsed_data.get("github_url"),
        professional_summary=parsed_data.get("professional_summary"),
        skills=parsed_data.get("skills"),
        technical_skills=parsed_data.get("technical_skills"),
        soft_skills=parsed_data.get("soft_skills"),
        education=parsed_data.get("education"),
        work_experience=parsed_data.get("work_experience"),
        projects=parsed_data.get("projects"),
        certifications=parsed_data.get("certifications"),
        internships=parsed_data.get("internships"),
        languages=parsed_data.get("languages"),
        achievements=parsed_data.get("achievements"),
        other_info=parsed_data.get("other_info"),
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


def get_resumes_by_user(db: Session, user_id: uuid.UUID) -> list[models.Resume]:
    """All resumes a given student has uploaded, most recent first."""
    return (
        db.query(models.Resume)
        .filter(models.Resume.user_id == user_id)
        .order_by(models.Resume.uploaded_at.desc())
        .all()
    )


def get_resume_by_id(db: Session, resume_id: uuid.UUID) -> models.Resume | None:
    return db.query(models.Resume).filter(models.Resume.id == resume_id).first()


def delete_resume(db: Session, resume: models.Resume) -> None:
    db.delete(resume)
    db.commit()


# ---------------------------------------------------------------------------
# CHATBOT CRUD
# ---------------------------------------------------------------------------

def create_chat_session(db: Session, user_id: uuid.UUID) -> models.ChatSession:
    session = models.ChatSession(user_id=user_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def get_chat_sessions(db: Session, user_id: uuid.UUID) -> list[models.ChatSession]:
    return db.query(models.ChatSession).filter(models.ChatSession.user_id == user_id).order_by(models.ChatSession.created_at.desc()).all()

def get_chat_session(db: Session, session_id: uuid.UUID, user_id: uuid.UUID) -> models.ChatSession | None:
    return db.query(models.ChatSession).filter(models.ChatSession.id == session_id, models.ChatSession.user_id == user_id).first()

def create_chat_message(db: Session, session_id: uuid.UUID, role: str, message: str) -> models.ChatMessage:
    msg = models.ChatMessage(session_id=session_id, role=role, message=message)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def get_chat_messages(db: Session, session_id: uuid.UUID) -> list[models.ChatMessage]:
    return db.query(models.ChatMessage).filter(models.ChatMessage.session_id == session_id).order_by(models.ChatMessage.created_at.asc()).all()
