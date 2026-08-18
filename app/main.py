# ---------------------------------------------------------------------------
# APP ENTRYPOINT
# ---------------------------------------------------------------------------
# Run with:  uvicorn app.main:app --reload
# ("app.main:app" = the `app` object inside app/main.py)
# ---------------------------------------------------------------------------

from fastapi import FastAPI

from app.database import Base, engine
from app.routers import auth, resume, internships

# Creates any table defined in app/models.py (via Base) that doesn't already
# exist in Postgres yet. Safe to run every startup — it does NOT touch or
# drop tables/columns that already exist (see README.md for how migrations
# would replace this once the schema needs to evolve after go-live).
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Internship Assistant API",
    description=(
        "RAG-powered internship matching: upload your resume and get semantically "
        "ranked internship recommendations based on your skills, education, and experience."
    ),
    version="2.0.0",
)

# Mounts every route defined in app/routers/auth.py (they're all prefixed
# with /auth, e.g. this adds /auth/register, /auth/login, ...).
app.include_router(auth.router)
app.include_router(resume.router)
app.include_router(internships.router)


@app.get("/")
def root():
    """Simple health check — hit this to confirm the server is up."""
    return {"status": "ok", "version": "2.0.0"}

