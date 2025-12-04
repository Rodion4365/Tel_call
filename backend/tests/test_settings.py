"""Test configuration settings."""
from app.config.settings import Settings


def test_settings_mask_database_url():
    """Test that database URL is properly masked."""
    settings = Settings(
        database_url="postgresql+asyncpg://user:password@localhost/dbname"
    )
    
    masked = settings.masked_database_url()
    
    assert "password" not in masked
    assert "***" in masked
    assert "user" in masked
    assert "localhost" in masked


def test_settings_defaults():
    """Test default settings values."""
    settings = Settings()
    
    assert settings.app_name == "Tel Call API"
    assert settings.debug is False
    assert settings.access_token_expire_minutes == 43200
