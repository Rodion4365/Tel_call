from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import session_scope
from app.models import Call, CallStatus, User
from app.models.friend_link import FriendLink
from app.models.participant import Participant
from app.services.auth import get_user_from_token
from app.services.signaling import call_room_manager

router = APIRouter()
logger = logging.getLogger("app.webrtc")


def _extract_token(websocket: WebSocket) -> tuple[str | None, str | None]:
    protocol_header = websocket.headers.get("sec-websocket-protocol")
    selected_protocol: str | None = None
    if protocol_header:
        protocol_values = [value.strip() for value in protocol_header.split(",") if value.strip()]
        if protocol_values:
            selected_protocol = protocol_values[0]
            token_candidate = protocol_values[-1]
            if token_candidate.lower().startswith("bearer "):
                token_candidate = token_candidate.split(" ", 1)[1]
            elif token_candidate.lower().startswith("token."):
                token_candidate = token_candidate.split(".", 1)[1]

            if token_candidate:
                return token_candidate, selected_protocol

    auth_header = websocket.headers.get("authorization") or websocket.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1], selected_protocol

    token = websocket.query_params.get("token")
    if token:
        return token, selected_protocol

    return None, selected_protocol


def _make_aware(dt: datetime | None) -> datetime | None:
    """Convert naive datetime to timezone-aware UTC datetime."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # Assume naive datetime is UTC
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def _create_or_update_friend_link(
    session: AsyncSession, user_id: int, friend_id: int
) -> None:
    """Create or update a friend link between two users.

    DEPRECATED: Use _batch_create_or_update_friend_links for better performance.
    """
    if user_id == friend_id:
        return  # Не создаём связь с самим собой

    # Двусторонняя связь: создаём две записи
    now = datetime.now(tz=timezone.utc)

    # Первая запись: user_id -> friend_id
    result = await session.execute(
        select(FriendLink).where(
            FriendLink.user_id == user_id, FriendLink.friend_id == friend_id
        )
    )
    existing_link = result.scalar_one_or_none()

    if existing_link:
        existing_link.updated_at = now
    else:
        friend_link = FriendLink(user_id=user_id, friend_id=friend_id)
        session.add(friend_link)

    # Вторая запись: friend_id -> user_id
    result = await session.execute(
        select(FriendLink).where(
            FriendLink.user_id == friend_id, FriendLink.friend_id == user_id
        )
    )
    existing_link = result.scalar_one_or_none()

    if existing_link:
        existing_link.updated_at = now
    else:
        friend_link = FriendLink(user_id=friend_id, friend_id=user_id)
        session.add(friend_link)

    logger.info("Created/updated bidirectional friend_link between user_id=%s and friend_id=%s", user_id, friend_id)


async def _batch_create_or_update_friend_links(
    session: AsyncSession, user_id: int, friend_ids: list[int]
) -> None:
    """Batch create or update friend links between user and multiple friends.

    Uses bidirectional model: creates TWO records for each friendship.
    Uses a single INSERT ... ON CONFLICT DO UPDATE query for efficiency.
    """
    if not friend_ids:
        return

    # Фильтруем user_id из списка друзей (не создаём связь с самим собой)
    friend_ids = [fid for fid in friend_ids if fid != user_id]
    if not friend_ids:
        return

    # Формируем двусторонние записи для всех друзей
    now = datetime.now(tz=timezone.utc)
    values = []

    for friend_id in friend_ids:
        # Запись: user_id -> friend_id
        values.append({
            "user_id": user_id,
            "friend_id": friend_id,
            "created_at": now,
            "updated_at": now,
        })
        # Запись: friend_id -> user_id
        values.append({
            "user_id": friend_id,
            "friend_id": user_id,
            "created_at": now,
            "updated_at": now,
        })

    # Используем INSERT ... ON CONFLICT DO UPDATE для PostgreSQL (upsert)
    # Это создаст новые записи или обновит updated_at для существующих
    stmt = insert(FriendLink).values(values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["user_id", "friend_id"],
        set_={"updated_at": now},
    )

    await session.execute(stmt)
    logger.info(
        "Batch created/updated %s bidirectional friend_link(s) for user_id=%s", len(friend_ids), user_id
    )


def _serialize_user(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "photo_url": user.photo_url,
    }


async def _ensure_active_call(call_id: str) -> tuple[Call | None, str | None]:
    async with session_scope() as session:
        result = await session.execute(select(Call).where(Call.call_id == call_id))
        call = result.scalar_one_or_none()

    if not call:
        return None, "Call not found. Please create a new call."

    # Handle both naive and aware datetimes for backwards compatibility
    expires_at = _make_aware(call.expires_at)
    if expires_at and expires_at < datetime.now(tz=timezone.utc):
        return None, "Call has expired. Please create a new call."

    if call.status != CallStatus.ACTIVE:
        if call.status == CallStatus.ENDED:
            return None, "Call has ended. Please create a new call."
        return None, "Call is not available. Please create a new call."

    return call, None


@router.websocket("/ws/calls/{call_id}")
async def call_signaling(websocket: WebSocket, call_id: str) -> None:
    """WebSocket endpoint for relaying WebRTC signaling messages."""

    logger.info(
        "Incoming WebSocket connection for call %s from %s", call_id, websocket.client
    )

    token, subprotocol = _extract_token(websocket)
    if not token:
        await websocket.close(code=4401, reason="Missing authentication token")
        logger.warning(
            "Rejected WebSocket connection for call %s: missing authentication token",
            call_id,
        )
        return

    async with session_scope() as session:
        try:
            user = await get_user_from_token(token, session)
        except HTTPException as exc:  # Authentication or token validation errors
            close_code = 4401 if exc.status_code == status.HTTP_401_UNAUTHORIZED else 1011
            await websocket.close(code=close_code, reason=str(exc.detail))
            logger.warning(
                "Authentication failed for call %s (close_code=%s): %s",
                call_id,
                close_code,
                exc.detail,
            )
            return
        except Exception:
            await websocket.close(code=1011, reason="Authentication failed")
            logger.exception("Unexpected error authenticating WebSocket for call %s", call_id)
            return

    call, reason = await _ensure_active_call(call_id)
    if call is None:
        await websocket.close(code=4404, reason=reason or "Call is not available")
        logger.warning(
            "Rejected WebSocket connection for call %s: %s", call_id, reason or "unknown reason"
        )
        return

    await websocket.accept(subprotocol=subprotocol)
    room = await call_room_manager.get_room(call_id)
    serialized_user = _serialize_user(user)
    await room.add_participant(user.id, websocket, serialized_user)

    # Сохраняем участника в БД для истории звонков
    participant_db_id: int | None = None
    async with session_scope() as session:
        # Проверяем, есть ли уже запись об участии (без left_at)
        result = await session.execute(
            select(Participant).where(
                Participant.call_id == call.id,
                Participant.user_id == user.id,
                Participant.left_at.is_(None),
            )
        )
        existing_participant = result.scalar_one_or_none()

        if not existing_participant:
            # Создаём новую запись
            participant = Participant(call_id=call.id, user_id=user.id)
            session.add(participant)
            await session.commit()
            await session.refresh(participant)
            participant_db_id = participant.id
            logger.info(
                "Created participant record id=%s for user_id=%s in call_id=%s",
                participant.id,
                user.id,
                call_id,
            )
        else:
            participant_db_id = existing_participant.id
            logger.info(
                "Reusing existing participant record id=%s for user_id=%s in call_id=%s",
                existing_participant.id,
                user.id,
                call_id,
            )

    # Создаём/обновляем friend_links между текущим пользователем и другими участниками звонка
    async with session_scope() as session:
        # Получаем всех других участников этого звонка
        result = await session.execute(
            select(Participant.user_id)
            .where(Participant.call_id == call.id, Participant.user_id != user.id)
            .distinct()
        )
        other_user_ids = [row[0] for row in result.fetchall()]

        # Создаём/обновляем связи с каждым участником одним batch запросом
        if other_user_ids:
            await _batch_create_or_update_friend_links(session, user.id, other_user_ids)
            await session.commit()
            logger.info(
                "Created/updated %s friend_link(s) for user_id=%s in call_id=%s",
                len(other_user_ids),
                user.id,
                call_id,
            )

    logger.info(
        "WebSocket accepted for call %s; user_id=%s username=%s", call_id, user.id, user.username
    )

    # Send call metadata including room start time (when first participant joined)
    await websocket.send_json({
        "type": "call_metadata",
        "room_start_time": room.start_time.isoformat(),
    })

    existing_participants = await room.list_participants(exclude_user_id=user.id)
    if existing_participants:
        await websocket.send_json({"type": "participants_snapshot", "participants": existing_participants})
        logger.debug(
            "Sent participants_snapshot to user_id=%s for call %s (participants=%s)",
            user.id,
            call_id,
            [participant.get("id") for participant in existing_participants],
        )

    await room.broadcast({"type": "user_joined", "user": serialized_user}, sender_id=user.id)

    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            logger.debug(
                "Received signaling message from user_id=%s call_id=%s: %s",
                user.id,
                call_id,
                message,
            )

            if message_type in {"offer", "answer", "ice_candidate"}:
                try:
                    target_user_id = int(message.get("to_user_id"))
                except (TypeError, ValueError):
                    await websocket.send_json(
                        {"type": "error", "detail": "Invalid or missing to_user_id"}
                    )
                    continue

                if not await room.has_participant(target_user_id):
                    await websocket.send_json({"type": "error", "detail": "Target user is offline"})
                    logger.warning(
                        "Target user %s is offline for message %s from user %s in call %s",
                        target_user_id,
                        message_type,
                        user.id,
                        call_id,
                    )
                    continue

                await room.broadcast(
                    {
                        "type": message_type,
                        "payload": message.get("payload"),
                        "from_user": _serialize_user(user),
                    },
                    sender_id=user.id,
                    target_id=target_user_id,
                )
                logger.info(
                    "Relayed %s from user %s to user %s in call %s",
                    message_type,
                    user.id,
                    target_user_id,
                    call_id,
                )
            else:
                await websocket.send_json({"type": "error", "detail": "Unsupported message type"})
                logger.warning(
                    "Unsupported signaling message from user %s in call %s: %s",
                    user.id,
                    call_id,
                    message,
                )
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for user %s in call %s", user.id, call_id)
    except Exception:
        logger.exception("Unhandled error in signaling loop for user %s in call %s", user.id, call_id)
        await websocket.close(code=1011, reason="Internal server error")
    finally:
        # Обновляем время выхода участника из звонка
        if participant_db_id is not None:
            async with session_scope() as session:
                result = await session.execute(
                    select(Participant).where(Participant.id == participant_db_id)
                )
                participant = result.scalar_one_or_none()
                if participant and participant.left_at is None:
                    participant.left_at = datetime.now(tz=timezone.utc)
                    await session.commit()
                    logger.info(
                        "Updated participant record id=%s left_at for user_id=%s in call_id=%s",
                        participant_db_id,
                        user.id,
                        call_id,
                    )

        await room.remove_participant(user.id)
        await room.broadcast({"type": "user_left", "user": _serialize_user(user)}, sender_id=user.id)
        await call_room_manager.cleanup_room(call_id)
        logger.info("Cleaned up WebSocket session for user %s in call %s", user.id, call_id)
