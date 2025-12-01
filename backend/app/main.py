from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.api import get_api_router
from app.config.database import Base, engine
from app.config.settings import get_settings
import app.models  # noqa: F401  # Ensure models are registered with metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify dependencies before serving requests."""

    # Validate database connectivity during startup.
    async with engine.begin() as connection:
        await connection.execute(text("SELECT 1"))
        await connection.run_sync(Base.metadata.create_all)
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

# Routers
app.include_router(get_api_router())
