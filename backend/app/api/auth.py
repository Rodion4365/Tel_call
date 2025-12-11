import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
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
    get_user_from_token,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
_bearer_scheme = HTTPBearer(auto_error=False)


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
    access_token: str  # For Telegram Mini Apps where cookies may not work
    token_type: str = "bearer"


class WebSocketTokenResponse(BaseModel):
    token: str


@router.get("/ws-token", response_model=WebSocketTokenResponse)
async def get_websocket_token(
    request: Request,
    response: Response,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> WebSocketTokenResponse:
    """Get a token from httpOnly cookie for WebSocket connections.

    WebSocket cannot automatically send httpOnly cookies, so this endpoint
    allows authenticated users to retrieve their token for WebSocket auth.
    """
    token = request.cookies.get("access_token")

    if token:
        return WebSocketTokenResponse(token=token)

    # Only attempt the fallback path for users who have lost their cookie
    # (e.g., it was cleared, blocked, or expired client-side). Users with a
    # working cookie return early above.
    if not token:
        # Fallback to bearer token for cases when cookie was cleared or not stored
        bearer_token = credentials.credentials if credentials else None
        if bearer_token:
            try:
                await get_user_from_token(bearer_token, session)
            except HTTPException as exc:
                logger.warning("[get_websocket_token] bearer token rejected: %s", exc.detail)
                raise

            settings = get_settings()
            response.set_cookie(
                key="access_token",
                value=bearer_token,
                httponly=True,
                secure=True,
                samesite="none",
                max_age=settings.access_token_expire_minutes * 60,
                path="/",
            )
            logger.info("[get_websocket_token] refreshed httpOnly cookie from Authorization header")
            token = bearer_token

    if not token:
        logger.warning("[get_websocket_token] no token found in cookie or Authorization header")
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
        "[authorize_telegram] issued token for user_id=%s, fp=%s",
        user.id,
        fingerprint,
    )
    settings = get_settings()

    # Set httpOnly cookie with JWT token (for browsers that support it)
    # Also return token in body for Telegram Mini Apps where cookies may be blocked
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,  # Only sent over HTTPS
        samesite="none",  # Allow in iframe (Telegram Mini App)
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )

    logger.info("Authorized Telegram user id=%s username=%s", user.id, user.username)

    return AuthResponse(
        expires_in=settings.access_token_expire_minutes * 60,
        user=user,
        access_token=token,
    )
