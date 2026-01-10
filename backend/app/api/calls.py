import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_session
from app.config.settings import get_settings
from app.models import Call, CallStatus, User
from app.models.participant import Participant
from app.services.auth import get_current_user
from app.services.signaling import notify_call_ended
from app.services.telegram_bot import send_call_notification

router = APIRouter(prefix="/api/calls", tags=["Calls"])
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)


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


class CallFriendRequest(BaseModel):
    friend_id: int = Field(..., description="Internal user ID of the friend to call")


def _make_aware(dt: datetime | None) -> datetime | None:
    """Convert naive datetime to timezone-aware UTC datetime."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # Assume naive datetime is UTC
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _build_join_url(call_id: str) -> str:
    settings = get_settings()
    if not settings.bot_username:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="BOT_USERNAME is not configured"
        )

    # Убираем @ из имени бота, если он есть
    bot_username = settings.bot_username.lstrip("@")
    return f"https://t.me/{bot_username}?startapp={call_id}"


@router.post("/", response_model=CallResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
@limiter.limit("30/hour")
async def create_call(
    request: Request,
    payload: CallCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CallResponse:
    """Create a new call and return its join details.

    Automatically ends the oldest active call if user exceeds max active calls limit.
    """
    settings = get_settings()

    # Проверяем количество активных звонков пользователя
    active_calls_result = await session.execute(
        select(Call)
        .where(
            Call.creator_user_id == current_user.id,
            Call.status == CallStatus.ACTIVE,
        )
        .order_by(Call.created_at.asc())  # Сортируем по времени создания (старые первыми)
    )
    active_calls = active_calls_result.scalars().all()

    # Если превышен лимит, завершаем самый старый звонок
    if len(active_calls) >= settings.max_active_calls_per_user:
        oldest_call = active_calls[0]
        oldest_call.status = CallStatus.ENDED

        # Уведомляем участников о завершении звонка (асинхронно)
        import asyncio
        asyncio.create_task(
            notify_call_ended(
                oldest_call.call_id,
                reason="Maximum active calls limit reached - oldest call auto-ended",
            )
        )

        logger.info(
            "User %s exceeded max active calls limit (%s), auto-ended oldest call %s",
            current_user.id,
            settings.max_active_calls_per_user,
            oldest_call.call_id,
        )

    expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=24)
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

    # Handle both naive and aware datetimes for backwards compatibility
    expires_at = _make_aware(call.expires_at)
    if expires_at and expires_at < datetime.now(tz=timezone.utc):
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

    # Handle both naive and aware datetimes for backwards compatibility
    expires_at = _make_aware(call.expires_at)
    if expires_at and expires_at < datetime.now(tz=timezone.utc):
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

    # Handle both naive and aware datetimes for backwards compatibility
    expires_at = _make_aware(call.expires_at)
    if expires_at and expires_at < datetime.now(tz=timezone.utc):
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


@router.post("/friend", response_model=CallResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
@limiter.limit("30/hour")
async def call_friend(
    request: Request,
    payload: CallFriendRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CallResponse:
    """Create a new call with a friend and send them a notification."""

    # Проверяем, что friend_id существует и не совпадает с текущим пользователем
    if payload.friend_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot call yourself",
        )

    # Получаем пользователя-друга
    result = await session.execute(select(User).where(User.id == payload.friend_id))
    friend = result.scalar_one_or_none()

    if not friend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend not found",
        )

    # Создаём новый звонок
    expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=24)
    call = Call(
        creator_user_id=current_user.id,
        title=None,
        is_video_enabled=False,
        expires_at=expires_at,
    )
    session.add(call)

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc

    await session.refresh(call)

    # Добавляем участников звонка
    # Инициатор звонка
    caller_participant = Participant(
        call_id=call.id,
        user_id=current_user.id,
    )
    session.add(caller_participant)

    # Друг, которому звоним
    friend_participant = Participant(
        call_id=call.id,
        user_id=friend.id,
    )
    session.add(friend_participant)

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to add participants",
        ) from exc

    # Формируем имя звонящего для уведомления
    caller_name = current_user.username or current_user.first_name or "Кто-то"

    # Отправляем пуш-уведомление другу
    # Используем call_id (не внутренний id), так как это то, что будет использоваться для подключения
    await send_call_notification(
        telegram_user_id=friend.telegram_user_id,
        caller_name=caller_name,
        call_id=call.call_id,
    )

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
