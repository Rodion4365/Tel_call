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
    create_refresh_token,
    get_or_create_user,
    get_user_from_token,
    _decode_user_id_from_token,
    _get_user_by_id,
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
    refresh_token: str  # Long-lived token to obtain new access tokens
    token_type: str = "bearer"


class WebSocketTokenResponse(BaseModel):
    token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = Field(None, description="Refresh token to obtain new access token")


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
@limiter.limit("3/minute")
@limiter.limit("20/hour")
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

    # Create both access and refresh tokens
    access_token = create_access_token(str(user.id), fingerprint=fingerprint)
    refresh_token = create_refresh_token(str(user.id))

    logger.info(
        "[authorize_telegram] issued tokens for user_id=%s, fp=%s",
        user.id,
        fingerprint,
    )
    settings = get_settings()

    # Set httpOnly cookies for both tokens (for browsers that support it)
    # Access token - short-lived (60 minutes)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,  # Only sent over HTTPS
        samesite="none",  # Allow in iframe (Telegram Mini App)
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )

    # Refresh token - long-lived (30 days)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
    )

    logger.info("Authorized Telegram user id=%s username=%s", user.id, user.username)

    return AuthResponse(
        expires_in=settings.access_token_expire_minutes * 60,
        user=user,
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=AuthResponse, status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
@limiter.limit("60/hour")
async def refresh_access_token(
    request: Request,
    response: Response,
    payload: RefreshTokenRequest | None = None,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    """Use refresh token to obtain new access and refresh tokens.

    Implements token rotation: when a refresh token is used, both a new access token
    and a new refresh token are issued. This improves security by limiting the lifetime
    of refresh tokens.

    The refresh token can be provided either:
    - In the request body (for Telegram Mini Apps where cookies may not work)
    - As an httpOnly cookie (for regular browser usage)
    """
    settings = get_settings()

    # Try to get refresh token from cookie first, then from request body
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value and payload and payload.refresh_token:
        refresh_token_value = payload.refresh_token

    if not refresh_token_value:
        logger.warning("[refresh_access_token] no refresh token provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is required"
        )

    # Validate refresh token and get user_id (will check token type)
    if not settings.secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SECRET_KEY is not configured"
        )

    try:
        user_id = _decode_user_id_from_token(
            refresh_token_value,
            settings.secret_key,
            expected_type="refresh"
        )
    except HTTPException as exc:
        logger.warning("[refresh_access_token] invalid refresh token: %s", exc.detail)
        raise

    # Get user from database
    user = await _get_user_by_id(session, user_id)
    if not user:
        logger.warning("[refresh_access_token] user_id=%s not found", user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Generate new tokens (token rotation for better security)
    # Note: We don't include fingerprint for refresh tokens since we don't have initData
    new_access_token = create_access_token(str(user.id))
    new_refresh_token = create_refresh_token(str(user.id))

    logger.info(
        "[refresh_access_token] issued new tokens for user_id=%s",
        user.id,
    )

    # Set httpOnly cookies for both tokens
    # Access token - short-lived (60 minutes)
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )

    # Refresh token - long-lived (30 days)
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
    )

    return AuthResponse(
        expires_in=settings.access_token_expire_minutes * 60,
        user=user,
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )
