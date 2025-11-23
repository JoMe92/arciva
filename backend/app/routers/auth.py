from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..db import get_db
from ..security import (
    SessionContext,
    clear_session_cookie,
    create_session,
    delete_session,
    get_current_user,
    hash_password,
    require_session,
    set_session_cookie,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(value: str) -> str:
    return value.strip().lower()


@router.post("/signup", response_model=schemas.UserOut, status_code=201)
async def signup(
    body: schemas.AuthSignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> schemas.UserOut:
    email = _normalize_email(str(body.email))
    existing = (
        await db.execute(select(models.User).where(models.User.email == email))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = models.User(email=email, password_hash=hash_password(body.password))
    db.add(user)
    await db.flush()
    session_token, expires_at = await create_session(db, user)
    await db.commit()
    set_session_cookie(response, session_token, expires_at=expires_at)
    return schemas.UserOut(id=user.id, email=user.email)


@router.post("/login", response_model=schemas.UserOut)
async def login(
    body: schemas.AuthLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> schemas.UserOut:
    email = _normalize_email(str(body.email))
    user = (
        await db.execute(select(models.User).where(models.User.email == email))
    ).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    session_token, expires_at = await create_session(db, user)
    await db.commit()
    set_session_cookie(response, session_token, expires_at=expires_at)
    return schemas.UserOut(id=user.id, email=user.email)


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    session_ctx: SessionContext = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    await delete_session(db, session_ctx.session)
    await db.commit()
    clear_session_cookie(response)
    return Response(status_code=204)


@router.get("/me", response_model=schemas.UserOut)
async def get_me(current_user: models.User = Depends(get_current_user)) -> schemas.UserOut:
    return schemas.UserOut(id=current_user.id, email=current_user.email)
