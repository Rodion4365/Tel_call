import logging
from functools import lru_cache
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

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
    access_token_expire_minutes: int = Field(
        60 * 24 * 30,
        validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES",
        description="JWT access token lifetime in minutes (defaults to 30 days)",
    )
    stun_servers: list[str] = Field(default_factory=list, validation_alias="STUN_SERVERS")
    turn_servers: list[str] = Field(default_factory=list, validation_alias="TURN_SERVERS")
    allowed_origins: list[str] = Field(default_factory=list, validation_alias="CORS_ALLOW_ORIGINS")

    def _mask_secret(self, value: Optional[str]) -> str:
        """Return a masked representation of sensitive values for logging."""

        if not value:
            return "<empty>"

        if len(value) <= 4:
            return "*" * len(value)

        return f"{value[:2]}***{value[-2:]}"

    def masked_database_url(self) -> str:
        """Return database URL without credentials for safe logging."""

        parsed = urlsplit(str(self.database_url))
        user = f"{parsed.username}:***@" if parsed.username else ""
        host = parsed.hostname or ""

        if parsed.port:
            host = f"{host}:{parsed.port}"

        netloc = f"{user}{host}"
        return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))

    def log_status(self, logger: logging.Logger) -> None:
        """Log expected environment variables and fail fast when missing."""

        required_mapping = {
            "database_url": "DATABASE_URL",
            "secret_key": "SECRET_KEY",
            "bot_token": "BOT_TOKEN",
            "bot_username": "BOT_USERNAME",
        }

        missing: list[str] = []

        for attribute, env_name in required_mapping.items():
            value = getattr(self, attribute)
            if value in (None, ""):
                missing.append(env_name)
                logger.error("Environment variable %s is missing", env_name)
            elif env_name == "DATABASE_URL":
                logger.info("Environment variable %s loaded: %s", env_name, self.masked_database_url())
            else:
                logger.info(
                    "Environment variable %s loaded: %s",
                    env_name,
                    self._mask_secret(str(value)),
                )

        if missing:
            raise RuntimeError(
                "Missing required environment variables: " + ", ".join(sorted(missing))
            )

        allowed = ", ".join(self.allowed_origins) if self.allowed_origins else "*"
        logger.info("CORS allowed origins: %s", allowed)

    @field_validator("stun_servers", "turn_servers", "allowed_origins", mode="before")
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
