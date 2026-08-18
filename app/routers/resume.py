# ---------------------------------------------------------------------------
# RESUME UPLOAD ROUTES
# ---------------------------------------------------------------------------
# These routes are all PROTECTED (`Depends(get_current_user)`) — a student
# must send a valid access token to upload or view resumes. That's how we
# know *which* student a resume belongs to: we never trust a user_id sent
# in the request body, we always take it from the verified token instead.
#
# Storage strategy: the actual file bytes are saved to disk under
# uploads/resumes/<user_id>/<random_name>.<ext>, and only the metadata
# (who uploaded it, original name, and where it's saved) goes in Postgres.
# ---------------------------------------------------------------------------

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import crud, schemas, resume_parser
from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/resume", tags=["resume"])

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

# Resolves to <project_root>/uploads/resumes regardless of where uvicorn is
# launched from. (this file lives at app/routers/resume.py, so parent.parent.parent
# steps back out of routers/ and app/ to the project root.)
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "resumes"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload", response_model=schemas.ResumeOut, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save an uploaded resume file to disk and record it in the `resumes`
    table, linked to whichever user's access token was sent."""

    original_name = Path(file.filename or "").name  # strips any directory part
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{extension}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 5 MB)")

    # One folder per user keeps resumes organized on disk and guarantees two
    # students uploading "resume.pdf" never collide with each other.
    user_dir = UPLOAD_DIR / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)

    # Never save the file under the student's own filename — a malicious
    # filename (e.g. "../../etc/passwd") could otherwise write outside the
    # intended folder. A fresh random name sidesteps that entirely.
    stored_filename = f"{uuid.uuid4().hex}{extension}"
    file_path = user_dir / stored_filename
    file_path.write_bytes(contents)

    # Parse the file we just saved: regex handles email/phone/links,
    # the LLM (Groq) handles everything contextual (skills, education,
    # work experience, ...). See app/resume_parser.py for the full pipeline.
    try:
        parsed_data = resume_parser.parse_resume(str(file_path))
    except Exception as e:
        # The file is already saved and still useful even if parsing
        # failed, so we don't delete it — we just record parsed_status
        # as "pending"/empty rather than failing the whole upload.
        # (see crud.create_resume: parsed_status becomes "pending" when
        # parsed_data is empty/None)
        parsed_data = None
        parse_error = str(e)
    else:
        parse_error = None

    # 201 is still correct even if parsing failed — the *upload* itself
    # succeeded. parsed_status="failed" tells the client to expect empty
    # extracted fields rather than assuming parsing ran fine.
    return crud.create_resume(
        db,
        user_id=current_user.id,
        original_filename=original_name,
        stored_filename=stored_filename,
        file_path=str(file_path),
        content_type=file.content_type or "application/octet-stream",
        file_size=len(contents),
        parsed_data=parsed_data,
        parsed_status="failed" if parse_error else None,
    )


@router.get("/", response_model=list[schemas.ResumeOut])
def list_my_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All resumes the logged-in student has uploaded."""
    return crud.get_resumes_by_user(db, current_user.id)


@router.get("/{resume_id}/download")
def download_resume(
    resume_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Streams the original file back. Checking `resume.user_id ==
    current_user.id` here is the important part — without it, any logged-in
    student could download by guessing another student's resume_id."""
    resume = crud.get_resume_by_id(db, resume_id)
    if resume is None or resume.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    return FileResponse(
        path=resume.file_path,
        filename=resume.original_filename,
        media_type=resume.content_type,
    )


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume_endpoint(
    resume_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes the resume from the database and disk."""
    resume = crud.get_resume_by_id(db, resume_id)
    if resume is None or resume.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    # Delete physical file
    try:
        Path(resume.file_path).unlink(missing_ok=True)
    except Exception:
        pass
        
    crud.delete_resume(db, resume)
