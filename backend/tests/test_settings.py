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


def test_settings_defaults(monkeypatch):
    """Test default settings values."""
    # Use minimal env vars to avoid validation errors
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    # Clear DEBUG to test actual default value
    monkeypatch.delenv("DEBUG", raising=False)
    settings = Settings()

    assert settings.app_name == "Tel Call API"
    assert settings.debug is False
    # Access token was changed to 60 minutes as part of security improvements
    assert settings.access_token_expire_minutes == 60
    # Refresh token expires in 30 days
    assert settings.refresh_token_expire_days == 30
