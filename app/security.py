# ---------------------------------------------------------------------------
# PASSWORD HASHING + JWT (JSON Web Token) HELPERS
# ---------------------------------------------------------------------------
# Two separate concerns live here:
#   1. Hashing passwords with bcrypt (so we never store/compare plaintext).
#   2. Creating & decoding the access/refresh JWTs used for login sessions.
# ---------------------------------------------------------------------------

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings


def hash_password(password: str) -> str:
    """One-way hash. Same password -> different hash each time (random salt),
    but verify_password() can still confirm a match. Used at register time."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """Used at login time: re-hashes the given password with the same salt
    (stored inside `hashed_password`) and compares. Never decrypt/compare raw."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def _create_token(subject: str, expires_delta: timedelta, token_type: str) -> str:
    """Builds and signs a JWT. A JWT is just a signed JSON payload — anyone
    can read its contents (it's NOT encrypted), but only someone with
    SECRET_KEY can produce a signature that verifies as valid. That's what
    makes it trustworthy: the server can tell if a client tampered with it.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,        # "subject" = who this token is about (user id)
        "type": token_type,    # "access" or "refresh" — see decode checks below
        "iat": now,            # issued-at
        "exp": now + expires_delta,  # expiry — jose rejects the token after this
        "jti": str(uuid.uuid4()),    # unique token id (useful for logging/audits)
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(user_id: str) -> str:
    """Short-lived token (default 30 min). Sent as `Authorization: Bearer <token>`
    on every request to a protected route, e.g. GET /auth/me."""
    return _create_token(
        subject=user_id,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
        token_type="access",
    )


def create_refresh_token(user_id: str) -> str:
    """Long-lived token (default 7 days). Its ONLY job is to be exchanged for
    a new access/refresh pair at POST /auth/refresh once the access token
    expires, so the user doesn't have to log in again every 30 minutes."""
    return _create_token(
        subject=user_id,
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
        token_type="refresh",
    )


def create_reset_token(user_id: str) -> str:
    """Short-lived token (default 15 min) emailed to the user on a
    forgot-password request. Uses the same signing mechanism as access/
    refresh tokens, but with its own `token_type` so it can't be reused
    as a login token even if someone tried to pass it to a protected route."""
    return _create_token(
        subject=user_id,
        expires_delta=timedelta(minutes=settings.reset_token_expire_minutes),
        token_type="reset",
    )


def decode_token(token: str) -> dict:
    """Verifies the signature + expiry and returns the payload dict.
    Raises ValueError (instead of jose's JWTError) so callers only need to
    catch one exception type regardless of *why* the token was invalid."""
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        raise ValueError("Invalid or expired token")
