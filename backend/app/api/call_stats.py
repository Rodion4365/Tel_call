"""Call statistics API endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_session
from app.models import User
from app.models.call_stats import CallStats
from app.models.call import Call
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/call-stats", tags=["Call Stats"])
logger = logging.getLogger(__name__)


class CallStatsCreate(BaseModel):
    """Request model for submitting call statistics."""

    call_id: str = Field(..., description="Call ID")
    duration_seconds: int | None = None
    audio_bitrate_kbps: float | None = None
    audio_packets_lost: int | None = None
    audio_packets_sent: int | None = None
    audio_jitter_ms: float | None = None
    video_bitrate_kbps: float | None = None
    video_packets_lost: int | None = None
    video_packets_sent: int | None = None
    video_frame_rate: float | None = None
    video_resolution: str | None = None
    rtt_ms: float | None = None


class CallStatsResponse(BaseModel):
    """Response model for call statistics."""

    id: int
    call_id: str
    user_id: int
    duration_seconds: int | None
    audio_bitrate_kbps: float | None
    audio_packets_lost: int | None
    audio_packets_sent: int | None
    audio_jitter_ms: float | None
    video_bitrate_kbps: float | None
    video_packets_lost: int | None
    video_packets_sent: int | None
    video_frame_rate: float | None
    video_resolution: str | None
    rtt_ms: float | None

    model_config = {"from_attributes": True}


class CallStatsAggregated(BaseModel):
    """Aggregated statistics for a call."""

    call_id: str
    participant_count: int
    avg_duration_seconds: float | None
    avg_audio_bitrate_kbps: float | None
    total_audio_packets_lost: int | None
    avg_audio_jitter_ms: float | None
    avg_rtt_ms: float | None


@router.post("/", response_model=CallStatsResponse, status_code=status.HTTP_201_CREATED)
async def create_call_stats(
    stats: CallStatsCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CallStatsResponse:
    """Submit call quality statistics."""
    logger.info(f"Creating call stats for call_id={stats.call_id}, user_id={user.id}")

    # Verify call exists
    stmt = select(Call).where(Call.call_id == stats.call_id)
    result = await session.execute(stmt)
    call = result.scalar_one_or_none()

    if not call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call not found",
        )

    # Create stats record
    call_stats = CallStats(
        call_id=stats.call_id,
        user_id=user.id,
        duration_seconds=stats.duration_seconds,
        audio_bitrate_kbps=stats.audio_bitrate_kbps,
        audio_packets_lost=stats.audio_packets_lost,
        audio_packets_sent=stats.audio_packets_sent,
        audio_jitter_ms=stats.audio_jitter_ms,
        video_bitrate_kbps=stats.video_bitrate_kbps,
        video_packets_lost=stats.video_packets_lost,
        video_packets_sent=stats.video_packets_sent,
        video_frame_rate=stats.video_frame_rate,
        video_resolution=stats.video_resolution,
        rtt_ms=stats.rtt_ms,
    )

    session.add(call_stats)
    await session.commit()
    await session.refresh(call_stats)

    logger.info(f"Call stats created with id={call_stats.id}")
    return call_stats


@router.get("/{call_id}", response_model=CallStatsAggregated)
async def get_call_stats(
    call_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CallStatsAggregated:
    """Get aggregated statistics for a call."""
    logger.info(f"Getting stats for call_id={call_id}, user_id={user.id}")

    # Verify call exists
    stmt = select(Call).where(Call.call_id == call_id)
    result = await session.execute(stmt)
    call = result.scalar_one_or_none()

    if not call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call not found",
        )

    # Get aggregated stats
    stmt = (
        select(
            func.count(CallStats.id).label("participant_count"),
            func.avg(CallStats.duration_seconds).label("avg_duration_seconds"),
            func.avg(CallStats.audio_bitrate_kbps).label("avg_audio_bitrate_kbps"),
            func.sum(CallStats.audio_packets_lost).label("total_audio_packets_lost"),
            func.avg(CallStats.audio_jitter_ms).label("avg_audio_jitter_ms"),
            func.avg(CallStats.rtt_ms).label("avg_rtt_ms"),
        )
        .where(CallStats.call_id == call_id)
    )

    result = await session.execute(stmt)
    row = result.one_or_none()

    if not row or row.participant_count == 0:
        return CallStatsAggregated(
            call_id=call_id,
            participant_count=0,
            avg_duration_seconds=None,
            avg_audio_bitrate_kbps=None,
            total_audio_packets_lost=None,
            avg_audio_jitter_ms=None,
            avg_rtt_ms=None,
        )

    return CallStatsAggregated(
        call_id=call_id,
        participant_count=row.participant_count,
        avg_duration_seconds=row.avg_duration_seconds,
        avg_audio_bitrate_kbps=row.avg_audio_bitrate_kbps,
        total_audio_packets_lost=row.total_audio_packets_lost,
        avg_audio_jitter_ms=row.avg_audio_jitter_ms,
        avg_rtt_ms=row.avg_rtt_ms,
    )


@router.get("/", response_model=list[CallStatsResponse])
async def list_user_call_stats(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    limit: int = 50,
) -> list[CallStatsResponse]:
    """Get call statistics for current user."""
    logger.info(f"Listing call stats for user_id={user.id}, limit={limit}")

    stmt = (
        select(CallStats)
        .where(CallStats.user_id == user.id)
        .order_by(CallStats.created_at.desc())
        .limit(limit)
    )

    result = await session.execute(stmt)
    stats = result.scalars().all()

    return list(stats)
