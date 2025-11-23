from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher, exceptions as argon2_exceptions
from fastapi import Depends, HTTPException, Request, Response
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner
from sqlalchemy.ext.asyncio import AsyncSession

from . import models
from .db import get_db
from .deps import Settings, get_settings

_PASSWORD_HASHER = PasswordHasher(time_cost=2, memory_cost=102400, parallelism=8, hash_len=32, salt_len=16)
SESSION_COOKIE_NAME = "arciva_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 14  # two weeks


@dataclass
class SessionContext:
    user: models.User
    session: models.UserSession


def hash_password(password: str) -> str:
    return _PASSWORD_HASHER.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _PASSWORD_HASHER.verify(hashed, password)
    except argon2_exceptions.VerifyMismatchError:
        return False
    except argon2_exceptions.VerificationError:
        return False


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _signer(settings: Settings) -> TimestampSigner:
    return TimestampSigner(settings.secret_key, salt="arciva-session")


def _ensure_aware(value: datetime | None) -> datetime | None:
    """
    SQLite stores naive timestamps; treat them as UTC so comparisons succeed.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _serialize_session_payload(session_id: uuid.UUID, token: str) -> str:
    return f"{session_id}:{token}"


def _deserialize_session_payload(payload: str) -> tuple[uuid.UUID, str] | None:
    if ":" not in payload:
        return None
    session_id_raw, token = payload.split(":", 1)
    try:
        session_id = uuid.UUID(session_id_raw)
    except ValueError:
        return None
    return session_id, token


async def create_session(
    db: AsyncSession,
    user: models.User,
    *,
    settings: Settings | None = None,
) -> tuple[str, datetime]:
    active_settings = settings or get_settings()
    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
    record = models.UserSession(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(record)
    await db.flush()
    payload = _serialize_session_payload(record.id, token)
    signed = _signer(active_settings).sign(payload).decode("utf-8")
    return signed, expires_at


async def delete_session(
    db: AsyncSession,
    session: models.UserSession,
) -> None:
    await db.delete(session)
    await db.flush()


def set_session_cookie(
    response: Response,
    value: str,
    *,
    expires_at: datetime,
    settings: Settings | None = None,
) -> None:
    active_settings = settings or get_settings()
    secure_cookie = active_settings.app_env.lower() == "prod"
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=value,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        max_age=SESSION_TTL_SECONDS,
        expires=int(expires_at.timestamp()),
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")


async def _load_session(
    db: AsyncSession,
    signed_value: str,
    *,
    settings: Settings,
) -> SessionContext | None:
    try:
        payload = _signer(settings).unsign(signed_value, max_age=SESSION_TTL_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    decoded = payload.decode("utf-8") if isinstance(payload, bytes) else str(payload)
    parsed = _deserialize_session_payload(decoded)
    if not parsed:
        return None
    session_id, raw_token = parsed
    session = await db.get(models.UserSession, session_id)
    if not session:
        return None
    expires_at = _ensure_aware(session.expires_at)
    if expires_at is None:
        return None
    session.expires_at = expires_at
    if expires_at < datetime.now(timezone.utc):
        return None
    if session.token_hash != _hash_token(raw_token):
        return None
    user = await db.get(models.User, session.user_id)
    if not user:
        return None
    session.last_seen_at = datetime.now(timezone.utc)
    return SessionContext(user=user, session=session)


async def resolve_session(
    request: Request,
    db: AsyncSession,
    *,
    settings: Settings | None = None,
) -> SessionContext | None:
    active_settings = settings or get_settings()
    cookie_value = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie_value:
        return None
    return await _load_session(db, cookie_value, settings=active_settings)


async def require_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SessionContext:
    ctx = await resolve_session(request, db)
    if not ctx:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return ctx


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> models.User:
    ctx = await resolve_session(request, db)
    if not ctx:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return ctx.user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> models.User | None:
    ctx = await resolve_session(request, db)
    if not ctx:
        return None
    return ctx.user
