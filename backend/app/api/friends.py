from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, case, delete, func, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_session
from app.models import User
from app.models.friend_link import FriendLink
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


class DeleteFriendsRequest(BaseModel):
    friend_ids: list[int]


class DeleteFriendsResponse(BaseModel):
    deleted_ids: list[int]
    not_found_ids: list[int]


@router.get("/", response_model=list[FriendResponse])
async def get_friends(
    query: str | None = Query(None, description="Search by name or username"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[FriendResponse]:
    """Get list of friends based on friend_links with optional search."""

    import logging
    logger = logging.getLogger(__name__)

    logger.info("[get_friends] Request from user_id=%s, query=%s, limit=%s, offset=%s",
                current_user.id, query, limit, offset)

    # Определяем friend_id в зависимости от того, где находится current_user
    # Если current_user.id в user_id_1, то friend_id = user_id_2, иначе friend_id = user_id_1
    friend_id_expr = case(
        (FriendLink.user_id_1 == current_user.id, FriendLink.user_id_2),
        else_=FriendLink.user_id_1,
    )

    # Основной запрос
    stmt = (
        select(User, FriendLink.updated_at.label("last_call_at"))
        .join(FriendLink, User.id == friend_id_expr)
        .where(
            or_(
                FriendLink.user_id_1 == current_user.id,
                FriendLink.user_id_2 == current_user.id,
            )
        )
    )

    # Добавляем фильтрацию по поисковому запросу
    if query:
        search_pattern = f"%{query}%"
        stmt = stmt.where(
            (User.first_name.ilike(search_pattern))
            | (User.last_name.ilike(search_pattern))
            | (User.username.ilike(search_pattern))
        )

    # Сортировка по дате последнего звонка (updated_at из friend_link)
    stmt = stmt.order_by(FriendLink.updated_at.desc())

    # Применяем пагинацию
    stmt = stmt.limit(limit).offset(offset)

    try:
        result = await session.execute(stmt)
        rows = result.all()

        logger.info("[get_friends] Found %d rows", len(rows))

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

            friend_response = FriendResponse(
                id=user.id,
                telegram_user_id=user.telegram_user_id,
                display_name=display_name,
                username=user.username,
                photo_url=user.photo_url,
                last_call_at=last_call_at,
            )
            friends.append(friend_response)

            logger.debug("[get_friends] Friend: id=%s, telegram_user_id=%s, display_name=%s, username=%s",
                        user.id, user.telegram_user_id, display_name, user.username)

        logger.info("[get_friends] Returning %d friends", len(friends))
        return friends

    except Exception as e:
        logger.exception("[get_friends] Error while fetching friends: %s", str(e))
        raise


@router.post("/delete", response_model=DeleteFriendsResponse)
async def delete_friends(
    request: DeleteFriendsRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DeleteFriendsResponse:
    """Delete friend links between current user and specified friends."""

    if not request.friend_ids:
        return DeleteFriendsResponse(deleted_ids=[], not_found_ids=[])

    # Формируем пары (user_id_1, user_id_2) для всех friend_ids
    user_id_pairs = [
        (min(current_user.id, friend_id), max(current_user.id, friend_id))
        for friend_id in request.friend_ids
    ]

    # Сначала проверяем какие записи существуют (один SELECT вместо N)
    result = await session.execute(
        select(FriendLink.user_id_1, FriendLink.user_id_2).where(
            tuple_(FriendLink.user_id_1, FriendLink.user_id_2).in_(user_id_pairs)
        )
    )
    existing_pairs = set(result.all())

    # Определяем какие friend_ids были найдены, а какие нет
    deleted_ids: list[int] = []
    not_found_ids: list[int] = []

    for friend_id in request.friend_ids:
        pair = (min(current_user.id, friend_id), max(current_user.id, friend_id))
        if pair in existing_pairs:
            deleted_ids.append(friend_id)
        else:
            not_found_ids.append(friend_id)

    # Удаляем все найденные записи одним запросом (один DELETE вместо N)
    if existing_pairs:
        await session.execute(
            delete(FriendLink).where(
                tuple_(FriendLink.user_id_1, FriendLink.user_id_2).in_(existing_pairs)
            )
        )

    # Коммитим все изменения
    await session.commit()

    return DeleteFriendsResponse(deleted_ids=deleted_ids, not_found_ids=not_found_ids)
