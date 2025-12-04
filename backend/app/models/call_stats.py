"""Call quality statistics model."""
from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base
from app.models.call import utc_now


class CallStats(Base):
    """Store call quality metrics and statistics."""

    __tablename__ = "call_stats"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    call_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("calls.call_id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    # Call duration
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Audio quality metrics
    audio_bitrate_kbps: Mapped[float | None] = mapped_column(Float, nullable=True)
    audio_packets_lost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_packets_sent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_jitter_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Video quality metrics (if applicable)
    video_bitrate_kbps: Mapped[float | None] = mapped_column(Float, nullable=True)
    video_packets_lost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    video_packets_sent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    video_frame_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    video_resolution: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Network quality
    rtt_ms: Mapped[float | None] = mapped_column(Float, nullable=True)  # Round-trip time

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
