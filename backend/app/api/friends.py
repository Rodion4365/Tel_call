from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, delete, or_, select
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

    # С двусторонней моделью запрос становится простым: ищем все записи где user_id = current_user.id
    # Каждая запись содержит friend_id и updated_at (время последнего звонка)
    stmt = (
        select(User, FriendLink.updated_at.label("last_call_at"))
        .join(FriendLink, FriendLink.friend_id == User.id)
        .where(FriendLink.user_id == current_user.id)
    )

    # Добавляем фильтрацию по поисковому запросу
    if query:
        search_pattern = f"%{query}%"
        stmt = stmt.where(
            (User.first_name.ilike(search_pattern))
            | (User.last_name.ilike(search_pattern))
            | (User.username.ilike(search_pattern))
        )

    # Сортировка по дате последнего звонка
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

        # Provide more helpful error messages
        error_msg = str(e).lower()
        if "no such table" in error_msg or "friend_links" in error_msg:
            from fastapi import HTTPException, status as http_status
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database not initialized. Please run migrations: alembic upgrade head"
            )
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

    # С двусторонней моделью нужно проверить существование связи в одном направлении
    # Если связь существует, удаляем обе записи: (user_id, friend_id) и (friend_id, user_id)
    result = await session.execute(
        select(FriendLink.friend_id).where(
            and_(
                FriendLink.user_id == current_user.id,
                FriendLink.friend_id.in_(request.friend_ids)
            )
        )
    )
    existing_friend_ids = set(row[0] for row in result.all())

    # Определяем какие friend_ids были найдены, а какие нет
    deleted_ids = [fid for fid in request.friend_ids if fid in existing_friend_ids]
    not_found_ids = [fid for fid in request.friend_ids if fid not in existing_friend_ids]

    # Удаляем все найденные связи в обоих направлениях одним запросом
    if deleted_ids:
        await session.execute(
            delete(FriendLink).where(
                or_(
                    # Удаляем (current_user.id, friend_id)
                    and_(
                        FriendLink.user_id == current_user.id,
                        FriendLink.friend_id.in_(deleted_ids)
                    ),
                    # Удаляем (friend_id, current_user.id)
                    and_(
                        FriendLink.user_id.in_(deleted_ids),
                        FriendLink.friend_id == current_user.id
                    )
                )
            )
        )

    # Коммитим все изменения
    await session.commit()

    return DeleteFriendsResponse(deleted_ids=deleted_ids, not_found_ids=not_found_ids)
