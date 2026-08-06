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

    # Required for the resume-parsing LLM pass (see app/resume_parser.py).
    groq_api_key: str

    class Config:
        env_file = ".env"   # tells pydantic-settings where to look
        extra = "ignore"    # ignore unrelated keys in .env


# Created once and imported everywhere else (app.database, app.security, ...)
# so settings are loaded a single time when the app starts.
settings = Settings()
