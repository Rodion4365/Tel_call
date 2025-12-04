from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
import secrets

from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class CallStatus(str, Enum):
    """Possible states of a call lifecycle."""

    ACTIVE = "active"
    ENDED = "ended"
    EXPIRED = "expired"


def generate_call_id() -> str:
    """Generate a cryptographically secure, URL-safe call identifier."""

    token = secrets.token_urlsafe(12)
    # Ensure identifier length stays within 16-20 characters.
    if len(token) < 16:
        token = secrets.token_urlsafe(16)
    return token[:20]


def utc_now() -> datetime:
    """Return current UTC time with timezone awareness."""
    return datetime.now(tz=timezone.utc)


class Call(Base):
    """Represents a voice or video call created by a user."""

    __tablename__ = "calls"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    call_id: Mapped[str] = mapped_column(String(20), unique=True, index=True, default=generate_call_id)
    creator_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_video_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[CallStatus] = mapped_column(SQLEnum(CallStatus), default=CallStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
