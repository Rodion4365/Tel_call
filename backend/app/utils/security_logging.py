"""Security event logging utilities.

This module provides structured logging for security-critical events.
All security events are logged with additional context for monitoring and alerting.
"""

import logging
from typing import Any

logger = logging.getLogger("app.security")


def log_security_event(
    event_type: str,
    description: str,
    severity: str = "warning",
    **extra_context: Any,
) -> None:
    """Log a structured security event.

    Args:
        event_type: Type of security event (e.g., "auth_failed", "rate_limit_exceeded")
        description: Human-readable description of the event
        severity: Log level - "info", "warning", "error", "critical"
        **extra_context: Additional context (user_id, ip_address, endpoint, etc.)

    Example:
        log_security_event(
            "auth_failed",
            "Invalid JWT token",
            severity="warning",
            user_id=123,
            ip_address="1.2.3.4",
            endpoint="/api/auth/login",
        )
    """
    log_data = {
        "event_type": event_type,
        "description": description,
        **extra_context,
    }

    # Convert to string format: "event_type=auth_failed user_id=123 ip=1.2.3.4 ..."
    log_message = " ".join(f"{k}={v}" for k, v in log_data.items())

    # Log with appropriate level
    log_func = getattr(logger, severity, logger.warning)
    log_func("[SECURITY] %s", log_message)


def log_auth_failure(
    reason: str,
    ip_address: str | None = None,
    user_id: int | None = None,
    endpoint: str | None = None,
    **extra: Any,
) -> None:
    """Log authentication failure event.

    Args:
        reason: Reason for authentication failure
        ip_address: Client IP address
        user_id: User ID (if available)
        endpoint: API endpoint
        **extra: Additional context
    """
    log_security_event(
        event_type="auth_failed",
        description=reason,
        severity="warning",
        user_id=user_id,
        ip_address=ip_address,
        endpoint=endpoint,
        **extra,
    )


def log_rate_limit_exceeded(
    ip_address: str | None = None,
    user_id: int | None = None,
    endpoint: str | None = None,
    limit: str | None = None,
    **extra: Any,
) -> None:
    """Log rate limit exceeded event.

    Args:
        ip_address: Client IP address
        user_id: User ID (if available)
        endpoint: API endpoint
        limit: Rate limit that was exceeded (e.g., "10/minute")
        **extra: Additional context
    """
    log_security_event(
        event_type="rate_limit_exceeded",
        description=f"Rate limit exceeded: {limit}" if limit else "Rate limit exceeded",
        severity="warning",
        user_id=user_id,
        ip_address=ip_address,
        endpoint=endpoint,
        limit=limit,
        **extra,
    )


def log_access_denied(
    reason: str,
    ip_address: str | None = None,
    user_id: int | None = None,
    endpoint: str | None = None,
    resource: str | None = None,
    **extra: Any,
) -> None:
    """Log access denied event.

    Args:
        reason: Reason for access denial
        ip_address: Client IP address
        user_id: User ID (if available)
        endpoint: API endpoint
        resource: Resource that was denied (e.g., call_id, file_path)
        **extra: Additional context
    """
    log_security_event(
        event_type="access_denied",
        description=reason,
        severity="warning",
        user_id=user_id,
        ip_address=ip_address,
        endpoint=endpoint,
        resource=resource,
        **extra,
    )


def log_suspicious_activity(
    description: str,
    ip_address: str | None = None,
    user_id: int | None = None,
    **extra: Any,
) -> None:
    """Log suspicious activity event.

    Args:
        description: Description of suspicious activity
        ip_address: Client IP address
        user_id: User ID (if available)
        **extra: Additional context
    """
    log_security_event(
        event_type="suspicious_activity",
        description=description,
        severity="error",
        user_id=user_id,
        ip_address=ip_address,
        **extra,
    )


def log_token_validation_failure(
    reason: str,
    token_type: str = "access",
    ip_address: str | None = None,
    user_id: int | None = None,
    endpoint: str | None = None,
    **extra: Any,
) -> None:
    """Log token validation failure event.

    Args:
        reason: Reason for validation failure (e.g., "expired", "invalid_signature")
        token_type: Type of token ("access" or "refresh")
        ip_address: Client IP address
        user_id: User ID (if available from token)
        endpoint: API endpoint
        **extra: Additional context
    """
    log_security_event(
        event_type="token_validation_failed",
        description=f"{token_type} token validation failed: {reason}",
        severity="warning",
        token_type=token_type,
        reason=reason,
        user_id=user_id,
        ip_address=ip_address,
        endpoint=endpoint,
        **extra,
    )
