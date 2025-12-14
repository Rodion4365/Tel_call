"""Structured logging configuration with JSON formatter."""

import logging
import sys
from typing import Any

from pythonjsonlogger import jsonlogger

from app.config.settings import get_settings


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter that adds standard fields to every log record."""

    def add_fields(
        self,
        log_record: dict[str, Any],
        record: logging.LogRecord,
        message_dict: dict[str, Any],
    ) -> None:
        """Add standard fields to the log record."""
        super().add_fields(log_record, record, message_dict)

        # Add timestamp
        if not log_record.get("timestamp"):
            log_record["timestamp"] = self.formatTime(record, self.datefmt)

        # Add level name
        if log_record.get("level"):
            log_record["level"] = log_record["level"].upper()
        else:
            log_record["level"] = record.levelname

        # Add logger name
        log_record["logger"] = record.name

        # Add module and function info for debug
        if record.levelno <= logging.DEBUG:
            log_record["module"] = record.module
            log_record["function"] = record.funcName
            log_record["line"] = record.lineno


class SensitiveDataFilter(logging.Filter):
    """Redact sensitive values such as tokens from log output."""

    def __init__(self, secrets: list[str] | tuple[str, ...]):
        super().__init__()
        self._secrets = [secret for secret in secrets if secret]

    def _mask(self, value: str) -> str:
        masked_value = value
        for secret in self._secrets:
            masked_value = masked_value.replace(secret, "[REDACTED]")
        return masked_value

    def _sanitize_args(self, args: Any) -> Any:
        if isinstance(args, tuple):
            return tuple(self._mask(str(arg)) for arg in args)
        if isinstance(args, dict):
            return {key: self._mask(str(val)) for key, val in args.items()}
        return self._mask(str(args))

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: D401 - required signature
        if self._secrets:
            if isinstance(record.msg, str):
                record.msg = self._mask(record.msg)
            if record.args:
                record.args = self._sanitize_args(record.args)
        return True


def configure_logging() -> None:
    """Configure logging with JSON formatter for production or simple formatter for development."""
    settings = get_settings()

    # Remove existing handlers
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)

    if settings.debug:
        # Development mode: use simple human-readable format
        formatter = logging.Formatter(
            "%(levelname)s %(asctime)s %(name)s:%(lineno)d - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        log_level = logging.DEBUG
    else:
        # Production mode: use JSON format for structured logging
        formatter = CustomJsonFormatter(
            "%(timestamp)s %(level)s %(name)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
        log_level = logging.INFO

    console_handler.setFormatter(formatter)
    console_handler.addFilter(
        SensitiveDataFilter(
            secrets=(settings.bot_token, settings.secret_key, settings.database_url)
        )
    )
    root_logger.addHandler(console_handler)
    root_logger.setLevel(log_level)

    # Prevent third-party libraries like httpx from logging sensitive URLs
    logging.getLogger("httpx").setLevel(logging.WARNING)

    # Set uvicorn loggers to use same format
    for logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        logger = logging.getLogger(logger_name)
        logger.handlers = []
        logger.propagate = True
