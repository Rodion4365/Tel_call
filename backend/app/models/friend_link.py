from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


def utc_now() -> datetime:
    """Return current UTC time with timezone awareness."""
    return datetime.now(tz=timezone.utc)


class FriendLink(Base):
    """Represents a friendship connection between two users.

    Uses bidirectional model: each friendship is stored as TWO records:
    - (user_A, user_B)
    - (user_B, user_A)

    This simplifies queries and eliminates the need for UNION operations.
    """

    __tablename__ = "friend_links"

    # Двусторонняя связь: для каждой пары друзей создаются две записи
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    friend_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    __table_args__ = (
        # Индекс для быстрого поиска друзей пользователя
        Index("ix_friend_links_user_id", "user_id"),
        # Индекс для сортировки по времени последнего звонка
        Index("ix_friend_links_updated_at", "updated_at"),
    )
