# ---------------------------------------------------------------------------
# AUTH ROUTES: register, login, refresh, logout, and a protected "/me" example
# ---------------------------------------------------------------------------
# A router groups related endpoints together (all prefixed with /auth here)
# so main.py can just do `app.include_router(auth.router)` instead of
# defining every route directly on `app`.
# ---------------------------------------------------------------------------

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app import crud, schemas, security
from app.config import settings
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

# HTTPBearer extracts the "Authorization: Bearer <token>" header from
# incoming requests. In Swagger UI (/docs), the Authorize button will show
# a simple "Value" field where you paste your access token directly.
http_bearer = HTTPBearer()


@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    """Create a new user account. `payload` is auto-validated against
    schemas.UserCreate before this function even runs."""
    if crud.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    return crud.create_user(db, payload.full_name, payload.email, payload.password)


@router.post("/login", response_model=schemas.TokenPair)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Verify credentials, then issue a fresh access + refresh token pair.
    The refresh token is also saved to the DB (see crud.store_refresh_token)
    so it can be looked up/revoked later."""
    user = crud.get_user_by_email(db, payload.email)
    if not user or not security.verify_password(payload.password, user.hashed_password):
        # Same error for "no such user" and "wrong password" on purpose —
        # this avoids leaking which emails are registered.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    access_token = security.create_access_token(str(user.id))
    refresh_token = security.create_refresh_token(str(user.id))
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    crud.store_refresh_token(db, user.id, refresh_token, expires_at)

    return schemas.TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=schemas.TokenPair)
def refresh(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a still-valid refresh token for a brand-new access + refresh
    pair, without requiring the user to log in again.

    "Rotation": every refresh call revokes the token that was just used and
    stores a new one. If a stolen refresh token is used by an attacker, and
    later the real user tries to refresh with their (now-revoked) copy,
    that mismatch is a signal the token was compromised.
    """
    try:
        decoded = security.decode_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Guard against someone sending an *access* token to this endpoint.
    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    # Signature/expiry can be valid while the token is still revoked in our
    # DB (e.g. already used once, or the user logged out) — check that too.
    db_token = crud.get_valid_refresh_token(db, payload.refresh_token)
    if db_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or revoked")

    crud.revoke_refresh_token(db, db_token)  # old token can never be reused

    user_id = decoded["sub"]
    access_token = security.create_access_token(user_id)
    new_refresh_token = security.create_refresh_token(user_id)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    crud.store_refresh_token(db, db_token.user_id, new_refresh_token, expires_at)

    return schemas.TokenPair(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Issues a short-lived reset token and stores it against the user.

    Always returns the same 200 message whether or not the email exists —
    returning a 404 for unregistered emails would let an attacker use this
    endpoint to check which emails have accounts, so the response is
    identical either way.

    In production, the token would be emailed rather than returned in the
    response body. It's returned here (under a clearly-named test-only key)
    purely so the flow is testable without an email service wired up.
    """
    user = crud.get_user_by_email(db, payload.email)
    if not user:
        return {"message": "If that email is registered, a reset link has been sent."}

    reset_token = security.create_reset_token(str(user.id))
    crud.set_reset_token(db, user, reset_token)

    return {
        "message": "If that email is registered, a reset link has been sent.",
        "reset_token_for_testing": reset_token,  # remove this key once email sending exists
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    """Validates the reset token and sets a new password. Used when the
    user doesn't have (or has forgotten) their current password — compare
    with /change-password below, which requires it."""
    try:
        decoded = security.decode_token(payload.reset_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    if decoded.get("type") != "reset":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token type")

    try:
        user_id = uuid.UUID(decoded["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")

    user = crud.get_user_by_id(db, user_id)

    # Reject if the user doesn't exist, or this isn't the *latest* token
    # issued for them (guards against a re-used or intercepted old link,
    # since requesting a new reset link overwrites the stored token).
    if not user or user.reset_token != payload.reset_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or already-used reset token")

    crud.update_password(db, user, security.hash_password(payload.new_password))
    crud.set_reset_token(db, user, None)  # single-use: clear it once consumed

    return {"message": "Password has been reset successfully"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    """Revokes the given refresh token so it can no longer be used to get
    new access tokens. Note: this does NOT invalidate an access token that
    was already issued — it will simply keep working until it expires
    (this is why access tokens are kept short-lived)."""
    db_token = crud.get_valid_refresh_token(db, payload.refresh_token)
    if db_token:
        crud.revoke_refresh_token(db, db_token)
    return None


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(http_bearer), db: Session = Depends(get_db)) -> User:
    """Reusable dependency for PROTECTED routes. Add
    `current_user: User = Depends(get_current_user)` to any route's
    parameters and FastAPI will require + validate a Bearer access token
    before that route function ever runs. See /me below for an example.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = credentials.credentials
    try:
        decoded = security.decode_token(token)
    except ValueError:
        raise credentials_error

    # Reject a refresh token being used where an access token is expected.
    if decoded.get("type") != "access":
        raise credentials_error

    try:
        user_id = uuid.UUID(decoded["sub"])
    except (KeyError, ValueError):
        raise credentials_error

    user = crud.get_user_by_id(db, user_id)
    if user is None:
        raise credentials_error
    return user


@router.get("/me", response_model=schemas.UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    """Example protected route. Copy this pattern for any endpoint that
    should only work for a logged-in user (e.g. future resume upload,
    profile update, application tracking routes)."""
    return current_user


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change password while logged in — requires the CURRENT password,
    unlike /reset-password which is for users who can't supply it."""
    if not security.verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    crud.update_password(db, current_user, security.hash_password(payload.new_password))
    return {"message": "Password changed successfully"}
