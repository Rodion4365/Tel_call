from functools import lru_cache
from typing import Optional

from pydantic import AnyUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = Field("Tel Call Backend", validation_alias="APP_NAME")
    debug: bool = Field(False, validation_alias="DEBUG")
    database_url: AnyUrl = Field(
        "sqlite+aiosqlite:///./app.db",
        validation_alias="DATABASE_URL",
        description="Database connection string. Defaults to a local SQLite DB.",
    )
    bot_token: Optional[str] = Field(None, validation_alias="BOT_TOKEN")
    bot_username: Optional[str] = Field(None, validation_alias="BOT_USERNAME")
    secret_key: Optional[str] = Field(None, validation_alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(15, validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    stun_servers: list[str] = Field(default_factory=list, validation_alias="STUN_SERVERS")
    turn_servers: list[str] = Field(default_factory=list, validation_alias="TURN_SERVERS")

    @field_validator("stun_servers", "turn_servers", mode="before")
    @classmethod
    def _split_csv(cls, value: str | list[str] | None) -> list[str]:
        """Allow comma-separated env values in addition to JSON arrays."""

        if value is None:
            return []

        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]

        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def _ensure_asyncpg_scheme(cls, value: str | AnyUrl | None) -> str | AnyUrl:
        """Default to SQLite and ensure PostgreSQL URLs use asyncpg."""

        if value in (None, ""):
            return "sqlite+aiosqlite:///./app.db"

        if isinstance(value, str) and value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)

        return value


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()  # type: ignore[arg-type]
