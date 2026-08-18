# This file centralizes all app "settings" so we never hardcode secrets or
# environment-specific values (like DB passwords) directly in the code.
# pydantic-settings automatically reads matching values from the .env file
# and validates their types (e.g. access_token_expire_minutes must be an int).
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # These two are required — the app will refuse to start without them.
    database_url: str
    secret_key: str

    # These have defaults, so .env can override them but doesn't have to.
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    reset_token_expire_minutes: int = 15  # how long a forgot-password link is valid for

    # Used as the LLM fallback for resume parsing (see app/resume_parser.py)
    # when regex extraction can't confidently pull a field out of a resume.
    # None (unset in .env) simply disables the LLM pass — regex-only extraction
    # still runs and results get stored.
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-120b"

    # ---------------------------------------------------------------------------
    # RAG / Vector store settings (see app/services/internship_index.py)
    # ---------------------------------------------------------------------------
    # Local sentence-transformers model — no API key / cost, runs on CPU.
    # Resumes and postings are embedded into the same vector space so
    # "distance between vectors" == "how well this resume fits this posting".
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Path (relative to project root) where internship postings are stored.
    internship_data_path: str = "app/data/internships.json"

    # Directory (relative to project root) where the FAISS index is persisted.
    # Run `python build_index.py` once after changing internships.json.
    internship_index_dir: str = "app/data/faiss_internship_index"

    class Config:
        env_file = ".env"   # tells pydantic-settings where to look
        extra = "ignore"    # ignore unrelated keys in .env


# Created once and imported everywhere else (app.database, app.security, ...)
# so settings are loaded a single time when the app starts.
settings = Settings()
