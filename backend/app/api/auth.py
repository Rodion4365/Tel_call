import logging

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_session
from app.config.settings import get_settings
from app.services.auth import (
    authenticate_user_from_init_data,
    build_init_data_fingerprint,
    create_access_token,
    get_or_create_user,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
logger = logging.getLogger(__name__)


class TelegramAuthRequest(BaseModel):
    init_data: str = Field(..., alias="initData", description="Raw Telegram initData string")


class UserResponse(BaseModel):
    id: int
    telegram_user_id: int
    username: str | None
    first_name: str | None
    last_name: str | None

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


@router.post("/telegram", response_model=AuthResponse, status_code=status.HTTP_200_OK)
async def authorize_telegram(
    payload: TelegramAuthRequest, session: AsyncSession = Depends(get_session)
) -> AuthResponse:
    """Validate Telegram initData, persist user, and issue a short-lived token."""

    logger.info("Received Telegram auth request")
    telegram_user = authenticate_user_from_init_data(payload.init_data)
    user = await get_or_create_user(session, telegram_user)
    fingerprint = build_init_data_fingerprint(payload.init_data)
    token = create_access_token(str(user.id), fingerprint=fingerprint)
    logger.info(
        "[authorize_telegram] issued token for user_id=%s, token_prefix=%s, fp=%s",
        user.id,
        token[:15] + "..." if token else "<empty>",
        fingerprint,
    )
    settings = get_settings()

    logger.info("Authorized Telegram user id=%s username=%s", user.id, user.username)

    return AuthResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=user,
    )
