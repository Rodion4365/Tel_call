from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_session
from app.models import Call, User
from app.models.participant import Participant
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/friends", tags=["Friends"])


class FriendResponse(BaseModel):
    id: int
    telegram_user_id: int
    display_name: str | None
    username: str | None
    photo_url: str | None
    last_call_at: datetime | None

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[FriendResponse])
async def get_friends(
    query: str | None = Query(None, description="Search by name or username"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[FriendResponse]:
    """Get list of friends (users from previous calls) with optional search."""

    # Подзапрос для получения всех пользователей, с которыми был в общих звонках
    # Находим все call_id, где был current_user
    user_calls_subq = (
        select(Participant.call_id)
        .where(Participant.user_id == current_user.id)
        .subquery()
    )

    # Находим всех участников из этих звонков, кроме самого пользователя
    friends_with_last_call = (
        select(
            User,
            func.max(Participant.joined_at).label("last_call_at"),
        )
        .join(Participant, Participant.user_id == User.id)
        .where(
            and_(
                Participant.call_id.in_(select(user_calls_subq)),
                User.id != current_user.id,
            )
        )
        .group_by(User.id)
    )

    # Добавляем фильтрацию по поисковому запросу
    if query:
        search_pattern = f"%{query}%"
        friends_with_last_call = friends_with_last_call.where(
            (User.first_name.ilike(search_pattern))
            | (User.last_name.ilike(search_pattern))
            | (User.username.ilike(search_pattern))
        )

    # Сортировка по дате последнего звонка
    friends_with_last_call = friends_with_last_call.order_by(
        func.max(Participant.joined_at).desc()
    )

    # Применяем пагинацию
    friends_with_last_call = friends_with_last_call.limit(limit).offset(offset)

    result = await session.execute(friends_with_last_call)
    rows = result.all()

    # Формируем ответ
    friends = []
    for row in rows:
        user = row[0]
        last_call_at = row[1]

        # Формируем display_name из first_name и last_name
        display_name = None
        if user.first_name or user.last_name:
            parts = []
            if user.first_name:
                parts.append(user.first_name)
            if user.last_name:
                parts.append(user.last_name)
            display_name = " ".join(parts)

        friends.append(
            FriendResponse(
                id=user.id,
                telegram_user_id=user.telegram_user_id,
                display_name=display_name,
                username=user.username,
                photo_url=user.photo_url,
                last_call_at=last_call_at,
            )
        )

    return friends
