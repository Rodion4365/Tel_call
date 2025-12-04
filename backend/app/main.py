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
from app.config.settings import get_settings
import app.models  # noqa: F401  # Ensure models are registered with metadata


settings = get_settings()

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(levelname)s %(asctime)s %(name)s:%(lineno)d - %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify dependencies before serving requests."""

    logger.info("Starting application lifespan checks")

    # Validate database connectivity during startup.
    try:
        async with engine.begin() as connection:
            logger.info("Validating database connectivity using %s", settings.masked_database_url())
            await connection.execute(text("SELECT 1"))
            await connection.run_sync(Base.metadata.create_all)
            logger.info("Database connectivity check succeeded; migrations are in sync")
    except Exception:
        logger.exception("Database connectivity check failed")
        await engine.dispose()
        raise

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
