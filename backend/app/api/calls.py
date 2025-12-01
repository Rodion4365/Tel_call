from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_session
from app.config.settings import get_settings
from app.models import Call, CallStatus, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/calls", tags=["Calls"])


class CallCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    is_video_enabled: bool = True


class CallResponse(BaseModel):
    call_id: str
    title: str | None
    is_video_enabled: bool
    status: CallStatus
    created_at: datetime
    expires_at: datetime | None
    join_url: str

    model_config = {"from_attributes": True}


@router.post("/", response_model=CallResponse, status_code=status.HTTP_201_CREATED)
async def create_call(
    payload: CallCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CallResponse:
    """Create a new call and return its join details."""

    settings = get_settings()
    if not settings.bot_username:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="BOT_USERNAME is not configured"
        )

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

    join_url = f"https://t.me/{settings.bot_username}?startapp={call.call_id}"
    return CallResponse(
        call_id=call.call_id,
        title=call.title,
        is_video_enabled=call.is_video_enabled,
        status=call.status,
        created_at=call.created_at,
        expires_at=call.expires_at,
        join_url=join_url,
    )
