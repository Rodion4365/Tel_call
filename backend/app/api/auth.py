import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
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
limiter = Limiter(key_func=get_remote_address)


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
    user: UserResponse
    expires_in: int


class WebSocketTokenResponse(BaseModel):
    token: str


@router.get("/ws-token", response_model=WebSocketTokenResponse)
async def get_websocket_token(request: Request) -> WebSocketTokenResponse:
    """Get a token from httpOnly cookie for WebSocket connections.

    WebSocket cannot automatically send httpOnly cookies, so this endpoint
    allows authenticated users to retrieve their token for WebSocket auth.
    """
    token = request.cookies.get("access_token")

    if not token:
        logger.warning("[get_websocket_token] no token found in cookie")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    return WebSocketTokenResponse(token=token)


@router.post("/telegram", response_model=AuthResponse, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def authorize_telegram(
    request: Request,
    response: Response,
    payload: TelegramAuthRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    """Validate Telegram initData, persist user, and issue httpOnly cookie with JWT."""

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

    # Set httpOnly cookie with JWT token
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,  # Only sent over HTTPS
        samesite="lax",  # CSRF protection
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )

    logger.info("Authorized Telegram user id=%s username=%s", user.id, user.username)

    return AuthResponse(
        expires_in=settings.access_token_expire_minutes * 60,
        user=user,
    )
