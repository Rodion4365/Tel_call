from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class Participant(Base):
    """Represents a user's presence in a call."""

    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    call_id: Mapped[int] = mapped_column(ForeignKey("calls.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
