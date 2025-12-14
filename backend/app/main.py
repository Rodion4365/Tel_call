import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import text

from app.api import get_api_router
from app.config.database import Base, engine
from app.config.logging import configure_logging
from app.config.settings import get_settings
import app.models  # noqa: F401  # Ensure models are registered with metadata
import app.services.bot_handlers  # noqa: F401  # Register bot handlers on startup


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

    # Configure Telegram webhook if BOT_WEBHOOK_URL is set
    if settings.bot_token and settings.bot_webhook_url:
        from app.tasks.set_webhook import configure_webhook_on_startup
        try:
            await configure_webhook_on_startup(settings.bot_webhook_url, settings.bot_token)
        except Exception:
            logger.exception("Failed to configure Telegram webhook on startup")
    elif settings.bot_token and not settings.bot_webhook_url:
        logger.warning(
            "Telegram webhook is not configured. The bot will not receive /start or /help commands. "
            "Set BOT_WEBHOOK_URL to auto-configure."
        )

    try:
        yield
    except asyncio.CancelledError:
        logger.info("Application lifespan cancelled during shutdown; exiting gracefully")
        return
    finally:
        await engine.dispose()
        logger.info("Database engine disposed")


settings.log_status(logger)

# Rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
allowed_origins = settings.allowed_origins or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Routers
app.include_router(get_api_router())
