from functools import lru_cache
from typing import Optional

from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = Field("Tel Call Backend", validation_alias="APP_NAME")
    debug: bool = Field(False, validation_alias="DEBUG")
    database_url: AnyUrl = Field(..., validation_alias="DATABASE_URL", description="PostgreSQL connection string")
    bot_token: Optional[str] = Field(None, validation_alias="BOT_TOKEN")
    secret_key: Optional[str] = Field(None, validation_alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(15, validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES")


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()  # type: ignore[arg-type]
