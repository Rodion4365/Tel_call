import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

# CORS
allowed_origins = settings.allowed_origins or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(get_api_router())
