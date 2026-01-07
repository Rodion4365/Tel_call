"""Test configuration settings."""
import os
from app.config.settings import Settings


def test_settings_mask_database_url(monkeypatch):
    """Test that database URL is properly masked."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost/dbname")
    settings = Settings()

    masked = settings.masked_database_url()

    assert "password" not in masked
    assert "***" in masked
    assert "user" in masked
    assert "localhost" in masked


def test_settings_defaults():
    """Test default settings values."""
    # Use minimal env vars to avoid validation errors
    os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    settings = Settings()

    assert settings.app_name == "Tel Call API"
    assert settings.debug is False
    assert settings.access_token_expire_minutes == 43200
