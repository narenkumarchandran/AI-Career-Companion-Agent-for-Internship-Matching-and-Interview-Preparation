# ---------------------------------------------------------------------------
# INTERNSHIP MATCHING ROUTES
# ---------------------------------------------------------------------------
# GET /internships/                    -> browse the synthetic catalog (public)
# GET /internships/match/{resume_id}   -> RAG match a resume against it (protected)
#
# The match route follows the same ownership-check pattern as
# GET /resume/{resume_id}/download in app/routers/resume.py: a 404 (not a
# 403) is returned for a resume that exists but belongs to someone else, so
# a caller can't distinguish "not found" from "not yours".
# ---------------------------------------------------------------------------

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user
from app.services.internship_index import list_all_postings
from app.services.internship_matcher import match_resume_to_internships

router = APIRouter(prefix="/internships", tags=["internships"])


@router.get("/", response_model=list[schemas.InternshipPosting])
def list_internships():
    """The full synthetic internship catalog (see app/data/internships.json).
    Static reference data, not tied to any user, so this is unauthenticated."""
    return list_all_postings()


@router.get("/match/{resume_id}", response_model=schemas.InternshipMatchResponse)
def match_internships(
    resume_id: uuid.UUID,
    k: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Runs the resume's parsed skills/education through the FAISS index of
    internship postings and returns the top-k most similar ones, each with
    a skill-gap breakdown and (if Groq is configured) a short summary.

    Returns a 404 if the resume doesn't exist or belongs to another user —
    deliberately indistinguishable so IDs can't be enumerated.
    Returns a 400 if the resume has no parseable content to match on (rare,
    but possible for a fully blank upload that failed parsing).
    Returns a 503 if the FAISS index hasn't been built yet.
    """
    resume = crud.get_resume_by_id(db, resume_id)
    if resume is None or resume.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    try:
        match_data = match_resume_to_internships(resume, k=k)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    if not match_data["results"] and match_data["query_skills"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This resume has no usable skills, education, or text to match on. "
                "Please re-upload a resume with extractable content."
            ),
        )

    return schemas.InternshipMatchResponse(resume_id=resume_id, **match_data)
