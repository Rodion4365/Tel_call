import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Provide required settings for app startup in tests
os.environ.setdefault("BOT_TOKEN", "123456:TESTTOKEN")
os.environ.setdefault("BOT_USERNAME", "test_bot")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("CORS_ALLOW_ORIGINS", "*")  # Allow all origins in tests

from app.main import app
from app.config.database import Base, get_session

# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    return engine


@pytest_asyncio.fixture
async def test_db(test_engine):
    """Create test database tables and session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(test_db):
    """Create test client with database session override."""

    async def override_get_session():
        yield test_db

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
