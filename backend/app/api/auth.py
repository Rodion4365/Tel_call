from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_session
from app.config.settings import get_settings
from app.services.auth import (
    authenticate_user_from_init_data,
    create_access_token,
    get_or_create_user,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


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

    telegram_user = authenticate_user_from_init_data(payload.init_data)
    user = await get_or_create_user(session, telegram_user)

    token = create_access_token(str(user.id))
    settings = get_settings()

    return AuthResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=user,
    )
