from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


def utc_now() -> datetime:
    """Return current UTC time with timezone awareness."""
    return datetime.now(tz=timezone.utc)


class FriendLink(Base):
    """Represents a friendship connection between two users."""

    __tablename__ = "friend_links"

    # Симметричная связь: всегда min(user_id) в user_id_1, max(user_id) в user_id_2
    user_id_1: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    user_id_2: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    __table_args__ = (
        # Индекс для быстрого поиска друзей пользователя
        Index("ix_friend_links_user_id_1", "user_id_1"),
        Index("ix_friend_links_user_id_2", "user_id_2"),
    )
