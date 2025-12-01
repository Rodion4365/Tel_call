from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qsl

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.config.database import get_session
from app.models import User


_bearer_scheme = HTTPBearer(auto_error=False)


def _build_data_check_string(payload: dict[str, str]) -> str:
    pairs = [f"{key}={value}" for key, value in sorted(payload.items()) if key != "hash"]
    return "\n".join(pairs)


def _validate_signature(init_data: str, bot_token: str) -> dict[str, str]:
    data = dict(parse_qsl(init_data, keep_blank_values=True))
    hash_from_client = data.get("hash")
    if not hash_from_client:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing hash in initData")

    secret_key = hashlib.sha256(bot_token.encode()).digest()
    data_check_string = _build_data_check_string(data)
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, hash_from_client):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid initData hash")

    return data


def validate_init_data(init_data: str, *, bot_token: str, max_age_seconds: int = 86400) -> dict[str, Any]:
    """Validate Telegram Mini App initData and return parsed payload.

    Args:
        init_data: Raw initData string from Telegram Mini App.
        bot_token: Telegram bot token used for signature verification.
        max_age_seconds: Allowed age for auth_date to mitigate replay attacks.
    """

    data = _validate_signature(init_data, bot_token)

    auth_date = data.get("auth_date")
    if auth_date:
        timestamp = datetime.fromtimestamp(int(auth_date), tz=timezone.utc)
        if datetime.now(tz=timezone.utc) - timestamp > timedelta(seconds=max_age_seconds):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="initData is too old")

    user_payload = data.get("user")
    if not user_payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing user payload in initData")

    try:
        user_data: dict[str, Any] = json.loads(user_payload)
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user payload") from exc

    return user_data


async def get_or_create_user(session: AsyncSession, telegram_user: dict[str, Any]) -> User:
    """Find or create a user based on Telegram payload."""

    telegram_user_id = telegram_user.get("id")
    if telegram_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Telegram user id is required")

    result = await session.execute(select(User).where(User.telegram_user_id == telegram_user_id))
    user = result.scalar_one_or_none()

    if user:
        user.username = telegram_user.get("username")
        user.first_name = telegram_user.get("first_name")
        user.last_name = telegram_user.get("last_name")
    else:
        user = User(
            telegram_user_id=telegram_user_id,
            username=telegram_user.get("username"),
            first_name=telegram_user.get("first_name"),
            last_name=telegram_user.get("last_name"),
        )
        session.add(user)

    await session.commit()
    await session.refresh(user)
    return user


def create_access_token(subject: str) -> str:
    settings = get_settings()
    if not settings.secret_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="SECRET_KEY is not configured")

    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(tz=timezone.utc) + expires_delta
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def authenticate_user_from_init_data(init_data: str) -> dict[str, Any]:
    """Validate initData using the configured bot token."""

    settings = get_settings()
    if not settings.bot_token:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="BOT_TOKEN is not configured")

    return validate_init_data(init_data, bot_token=settings.bot_token)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Extract and validate the current user from a bearer token."""

    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    settings = get_settings()
    if not settings.secret_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="SECRET_KEY is not configured")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id = payload.get("sub")
    except jwt.ExpiredSignatureError as exc:  # pragma: no cover - expiry path
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await session.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user
