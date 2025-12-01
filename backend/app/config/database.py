from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config.settings import get_settings


class Base(DeclarativeBase):
    """Base class for ORM models."""


settings = get_settings()

engine: AsyncEngine = create_async_engine(str(settings.database_url), echo=settings.debug, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


@asynccontextmanager
async def get_session() -> AsyncIterator[AsyncSession]:
    """Provide an async database session."""

    session: AsyncSession = SessionLocal()
    try:
        yield session
    finally:
        await session.close()
