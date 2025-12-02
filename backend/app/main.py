import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.api import get_api_router
from app.config.database import Base, engine
from app.config.settings import get_settings
import app.models  # noqa: F401  # Ensure models are registered with metadata


logging.basicConfig(
    level=logging.INFO,
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
        raise
    yield


settings = get_settings()
settings.log_status(logger)
app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

# Routers
app.include_router(get_api_router())
