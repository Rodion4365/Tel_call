from __future__ import annotations

import hashlib
import hmac
import json
import logging
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


logger = logging.getLogger(__name__)
_bearer_scheme = HTTPBearer(auto_error=False)


def _build_data_check_string(payload: dict[str, str]) -> str:
    pairs = [f"{key}={value}" for key, value in sorted(payload.items()) if key != "hash"]
    return "\n".join(pairs)


def _validate_signature(init_data: str, bot_token: str) -> dict[str, str]:
    data = dict(parse_qsl(init_data, keep_blank_values=True))
    hash_from_client = data.get("hash")
    if not hash_from_client:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing hash in initData")

    # https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    # secret_key = HMAC_SHA256("WebAppData", <bot_token>)
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    data_check_string = _build_data_check_string(data)
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, hash_from_client):
        logger.warning("Telegram initData signature validation failed")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid initData hash")

    return data


def validate_init_data(init_data: str, *, bot_token: str, max_age_seconds: int = 86400) -> dict[str, Any]:
    """Validate Telegram Mini App initData and return parsed payload.

    Args:
        init_data: Raw initData string from Telegram Mini App.
        bot_token: Telegram bot token used for signature verification.
        max_age_seconds: Allowed age for auth_date to mitigate replay attacks.
    """

    logger.info("Validating Telegram initData payload")
    data = _validate_signature(init_data, bot_token)

    auth_date = data.get("auth_date")
    if auth_date:
        timestamp = datetime.fromtimestamp(int(auth_date), tz=timezone.utc)
        if datetime.now(tz=timezone.utc) - timestamp > timedelta(seconds=max_age_seconds):
            logger.warning("Received expired initData payload: auth_date=%s", auth_date)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="initData is too old")

    user_payload = data.get("user")
    if not user_payload:
        logger.warning("Received initData payload without user info")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing user payload in initData")

    try:
        user_data: dict[str, Any] = json.loads(user_payload)
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user payload") from exc

    logger.info(
        "Telegram initData validated for user_id=%s username=%s",
        user_data.get("id"),
        user_data.get("username"),
    )

    return user_data


async def get_or_create_user(session: AsyncSession, telegram_user: dict[str, Any]) -> User:
    """Find or create a user based on Telegram payload."""

    telegram_user_id = telegram_user.get("id")
    if telegram_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Telegram user id is required")

    result = await session.execute(select(User).where(User.telegram_user_id == telegram_user_id))
    user = result.scalar_one_or_none()
    is_new = user is None

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
    logger.info(
        "User %s persisted (id=%s, username=%s)",
        "created" if is_new else "updated",
        user.id,
        user.username,
    )
    return user


def build_init_data_fingerprint(init_data: str) -> str:
    """Return a short fingerprint of the validated initData payload."""

    digest = hashlib.sha256(init_data.encode()).hexdigest()
    return digest[:16]


def create_access_token(subject: str, *, fingerprint: str | None = None) -> str:
    settings = get_settings()
    if not settings.secret_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="SECRET_KEY is not configured")

    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(tz=timezone.utc) + expires_delta
    to_encode = {"sub": subject, "exp": expire}
    if fingerprint:
        to_encode["fp"] = fingerprint
    token = jwt.encode(to_encode, settings.secret_key, algorithm="HS256")
    logger.info(
        "Issued access token for user_id=%s with ttl_minutes=%s fingerprint=%s",
        subject,
        settings.access_token_expire_minutes,
        fingerprint or "<none>",
    )
    return token


def authenticate_user_from_init_data(init_data: str) -> dict[str, Any]:
    """Validate initData using the configured bot token."""

    settings = get_settings()
    if not settings.bot_token:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="BOT_TOKEN is not configured")

    user_data = validate_init_data(init_data, bot_token=settings.bot_token)
    logger.info(
        "Authenticated Telegram user payload for user_id=%s username=%s",
        user_data.get("id"),
        user_data.get("username"),
    )
    return user_data


def _decode_user_id_from_token(token: str, secret_key: str) -> int:
    try:
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        user_id = payload.get("sub")
    except jwt.ExpiredSignatureError as exc:  # pragma: no cover - expiry path
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    return int(user_id)


async def _get_user_by_id(session: AsyncSession, user_id: int) -> User:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def _resolve_user_from_token(token: str, session: AsyncSession, secret_key: str) -> User:
    user_id = _decode_user_id_from_token(token, secret_key)
    return await _get_user_by_id(session, user_id)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Extract and validate the current user from a bearer token."""

    if credentials is None:
        logger.warning("[get_current_user] no Authorization header or wrong scheme")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = credentials.credentials
    logger.info(
        "[get_current_user] got token_prefix=%s",
        token[:15] + "..." if token else "<empty>",
    )

    settings = get_settings()
    if not settings.secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SECRET_KEY is not configured",
        )

    try:
        user = await _resolve_user_from_token(token, session, settings.secret_key)
    except HTTPException as exc:
        logger.warning("[get_current_user] token rejected: %s", exc.detail)
        raise

    logger.info("[get_current_user] authenticated user_id=%s", user.id)
    return user


async def get_user_from_token(token: str, session: AsyncSession) -> User:
    """Validate a raw bearer token and return the associated user."""

    settings = get_settings()
    if not settings.secret_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="SECRET_KEY is not configured")

    return await _resolve_user_from_token(token, session, settings.secret_key)
