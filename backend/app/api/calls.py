from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_session
from app.config.settings import get_settings
from app.models import Call, CallStatus, User
from app.services.auth import get_current_user
from app.services.signaling import notify_call_ended

router = APIRouter(prefix="/api/calls", tags=["Calls"])


class CallCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    is_video_enabled: bool = False

    model_config = {"extra": "ignore"}


class CallResponse(BaseModel):
    call_id: str
    title: str | None
    is_video_enabled: bool
    status: CallStatus
    created_at: datetime
    expires_at: datetime | None
    join_url: str

    model_config = {"from_attributes": True}


class JoinCallRequest(BaseModel):
    call_code: str = Field(..., min_length=1, max_length=255)


def _build_join_url(call_id: str) -> str:
    settings = get_settings()
    if not settings.bot_username:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="BOT_USERNAME is not configured"
        )

    return f"https://t.me/{settings.bot_username}/app?startapp={call_id}"


@router.post("/", response_model=CallResponse, status_code=status.HTTP_201_CREATED)
async def create_call(
    payload: CallCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CallResponse:
    """Create a new call and return its join details."""

    expires_at = datetime.utcnow() + timedelta(hours=24)
    call = Call(
        creator_user_id=current_user.id,
        title=payload.title,
        is_video_enabled=payload.is_video_enabled,
        expires_at=expires_at,
    )
    session.add(call)

    try:
        await session.commit()
    except SQLAlchemyError as exc:  # pragma: no cover - runtime safety
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable"
        ) from exc

    await session.refresh(call)

    join_url = _build_join_url(call.call_id)
    return CallResponse(
        call_id=call.call_id,
        title=call.title,
        is_video_enabled=call.is_video_enabled,
        status=call.status,
        created_at=call.created_at,
        expires_at=call.expires_at,
        join_url=join_url,
    )


@router.get("/{call_id}", response_model=CallResponse)
async def get_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CallResponse:
    """Retrieve call details ensuring the call is still available."""

    result = await session.execute(select(Call).where(Call.call_id == call_id))
    call = result.scalar_one_or_none()

    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")

    error_detail = None

    if call.expires_at and call.expires_at < datetime.utcnow():
        call.status = CallStatus.EXPIRED
        error_detail = "Call has expired"
    elif call.status != CallStatus.ACTIVE:
        error_detail = "Call is not available"

    try:
        await session.commit()
    except SQLAlchemyError as exc:  # pragma: no cover - runtime safety
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable"
        ) from exc

    await session.refresh(call)

    if error_detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_detail)

    join_url = _build_join_url(call.call_id)
    return CallResponse(
        call_id=call.call_id,
        title=call.title,
        is_video_enabled=call.is_video_enabled,
        status=call.status,
        created_at=call.created_at,
        expires_at=call.expires_at,
        join_url=join_url,
    )


@router.post("/{call_id}/end", response_model=CallResponse)
async def end_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CallResponse:
    """End an active call and notify all participants."""

    result = await session.execute(select(Call).where(Call.call_id == call_id))
    call = result.scalar_one_or_none()

    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")

    if call.creator_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organizer can end the call")

    if call.expires_at and call.expires_at < datetime.utcnow():
        call.status = CallStatus.EXPIRED
    elif call.status != CallStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Call is no longer active. Please create a new call.",
        )
    else:
        call.status = CallStatus.ENDED

    try:
        await session.commit()
    except SQLAlchemyError as exc:  # pragma: no cover - runtime safety
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable"
        ) from exc

    await session.refresh(call)
    await notify_call_ended(call.call_id, reason=call.status.value)

    join_url = _build_join_url(call.call_id)
    return CallResponse(
        call_id=call.call_id,
        title=call.title,
        is_video_enabled=call.is_video_enabled,
        status=call.status,
        created_at=call.created_at,
        expires_at=call.expires_at,
        join_url=join_url,
    )


@router.post("/join_by_code", response_model=CallResponse)
async def join_call_by_code(
    payload: JoinCallRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CallResponse:
    """Validate that the call exists and is available for joining."""

    call_code = payload.call_code.strip()

    if not call_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call code is required")

    result = await session.execute(select(Call).where(Call.call_id == call_code))
    call = result.scalar_one_or_none()

    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")

    if call.expires_at and call.expires_at < datetime.utcnow():
        call.status = CallStatus.EXPIRED
        error_detail = "Call has expired"
    elif call.status != CallStatus.ACTIVE:
        error_detail = "Call is not available"
    else:
        error_detail = None

    try:
        await session.commit()
    except SQLAlchemyError as exc:  # pragma: no cover - runtime safety
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable"
        ) from exc

    await session.refresh(call)

    if error_detail:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_detail)

    join_url = _build_join_url(call.call_id)
    return CallResponse(
        call_id=call.call_id,
        title=call.title,
        is_video_enabled=call.is_video_enabled,
        status=call.status,
        created_at=call.created_at,
        expires_at=call.expires_at,
        join_url=join_url,
    )
