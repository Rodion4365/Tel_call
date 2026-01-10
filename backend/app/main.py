import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

from app.api import get_api_router
from app.config.database import Base, engine
from app.config.logging import configure_logging
from app.config.settings import get_settings
import app.models  # noqa: F401  # Ensure models are registered with metadata
import app.services.bot_handlers  # noqa: F401  # Register bot handlers on startup
from app.services.telegram_bot import log_webhook_status
from app.utils.security_logging import log_rate_limit_exceeded


settings = get_settings()

# Configure structured logging (JSON in production, simple in development)
configure_logging()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify dependencies before serving requests."""

    logger.info("Starting application lifespan checks")

    # Validate database connectivity during startup.
    # NOTE: Run database migrations before starting the server:
    #   alembic upgrade head
    try:
        async with engine.begin() as connection:
            logger.info("Validating database connectivity using %s", settings.masked_database_url())
            await connection.execute(text("SELECT 1"))
            logger.info("Database connectivity check succeeded")
    except Exception:
        logger.exception("Database connectivity check failed")
        await engine.dispose()
        raise

    # Start background cleanup task for stale rooms
    from app.services.signaling import call_room_manager
    call_room_manager.start_cleanup_task()

    # Log Telegram webhook status to help diagnose missing bot replies
    await log_webhook_status()

    try:
        yield
    except asyncio.CancelledError:
        logger.info("Application lifespan cancelled during shutdown; exiting gracefully")
        return
    finally:
        await engine.dispose()
        logger.info("Database engine disposed")


settings.log_status(logger)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Custom rate limit exceeded handler with security logging."""
    # Extract client info
    ip_address = get_remote_address(request)
    endpoint = request.url.path

    # Log security event
    log_rate_limit_exceeded(
        ip_address=ip_address,
        endpoint=endpoint,
        limit=str(exc.detail) if hasattr(exc, 'detail') else None,
    )

    # Return rate limit response
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded"},
        headers={"Retry-After": "60"},
    )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response: StarletteResponse = await call_next(request)

        # Content Security Policy - защита от XSS
        # Разрешаем:
        # - self: текущий домен
        # - unsafe-inline/unsafe-eval: для React и динамических скриптов (можно ужесточить позже)
        # - telegram.org: для Telegram Web App SDK
        # - connect-src: WebSocket соединения
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org; "
            "connect-src 'self' wss: https:; "
            "img-src 'self' data: https: blob:; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self' data:; "
            "frame-ancestors 'none';"
        )

        # X-Content-Type-Options - предотвращает MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # X-Frame-Options - защита от clickjacking
        # Note: CSP frame-ancestors более современный, но оставляем для совместимости
        response.headers["X-Frame-Options"] = "DENY"

        # X-XSS-Protection - включает встроенную защиту браузера от XSS
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer-Policy - контролирует передачу referrer информации
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions-Policy - отключаем ненужные browser features
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=()"
        )

        return response


# Rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# CORS
allowed_origins = settings.allowed_origins
if not allowed_origins:
    if settings.debug:
        logger.warning(
            "CORS_ALLOW_ORIGINS is not configured. Using wildcard '*' in development mode. "
            "This is UNSAFE for production!"
        )
        allowed_origins = ["*"]
    else:
        logger.error("CORS_ALLOW_ORIGINS must be explicitly set in production!")
        raise RuntimeError(
            "CORS_ALLOW_ORIGINS environment variable is required in production. "
            "Set it to your frontend domain(s), e.g., 'https://app.callwith.ru'"
        )

if "*" in allowed_origins and not settings.debug:
    logger.error("Wildcard CORS origin '*' is not allowed in production!")
    raise RuntimeError(
        "Wildcard CORS origin '*' is not secure for production. "
        "Please specify explicit allowed origins."
    )

logger.info("CORS allowed origins: %s", ", ".join(allowed_origins))
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# TEMPORARILY DISABLED: Security Headers
# TODO: Move CSP to frontend nginx config, backend API doesn't need CSP
# Problem: frame-ancestors 'none' blocks Telegram Mini App which runs in iframe
# app.add_middleware(SecurityHeadersMiddleware)
# logger.info("Security headers middleware enabled")

# Routers
app.include_router(get_api_router())
