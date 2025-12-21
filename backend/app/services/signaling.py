from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, WebSocket, status

from app.config.settings import get_settings

logger = logging.getLogger("app.webrtc")


@dataclass
class ParticipantConnection:
    """Represents a participant connection and metadata."""

    websocket: WebSocket
    user: dict[str, Any]
    reconnect_task: asyncio.Task | None = None
    is_reconnecting: bool = False


class CallRoom:
    """Manage WebSocket participants for a specific call."""

    def __init__(self, call_id: str) -> None:
        self.call_id = call_id
        self._participants: dict[int, ParticipantConnection] = {}
        self._lock = asyncio.Lock()
        # Время начала комнаты (когда первый участник вошел)
        self.start_time = datetime.now(tz=timezone.utc)
        # Время последней активности (для cleanup пустых комнат)
        self.last_activity = time.time()

    @property
    def is_empty(self) -> bool:
        return not self._participants

    async def add_participant(self, user_id: int, websocket: WebSocket, user: dict[str, Any]) -> None:
        """Register a connected user in the room.

        Raises:
            HTTPException: If the room has reached maximum participant capacity.
        """
        settings = get_settings()

        async with self._lock:
            # Проверяем лимит участников
            if len(self._participants) >= settings.max_participants_per_call:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Call is full (maximum {settings.max_participants_per_call} participants allowed)",
                )

            self._participants[user_id] = ParticipantConnection(websocket, user)
            self.last_activity = time.time()

        logger.info(
            "User %s joined call %s (participants=%s/%s)",
            user_id,
            self.call_id,
            len(self._participants),
            settings.max_participants_per_call,
        )

    async def remove_participant(self, user_id: int) -> None:
        """Remove a user from the room if present."""

        async with self._lock:
            # Cancel any reconnect task before removing
            participant = self._participants.get(user_id)
            if participant and participant.reconnect_task:
                participant.reconnect_task.cancel()

            self._participants.pop(user_id, None)
            self.last_activity = time.time()

        logger.info(
            "User %s left call %s (participants=%s)",
            user_id,
            self.call_id,
            len(self._participants),
        )

    async def has_participant(self, user_id: int) -> bool:
        """Return True when the user is connected to the room."""

        async with self._lock:
            return user_id in self._participants

    async def is_participant_reconnecting(self, user_id: int) -> bool:
        """Return True if the user is in reconnecting state."""

        async with self._lock:
            participant = self._participants.get(user_id)
            return participant.is_reconnecting if participant else False

    async def mark_participant_reconnecting(
        self,
        user_id: int,
        participant_db_id: int,
        call_db_id: int,
    ) -> None:
        """Mark a participant as reconnecting and start timeout timer."""
        settings = get_settings()

        async with self._lock:
            participant = self._participants.get(user_id)
            if not participant:
                return

            participant.is_reconnecting = True

            # Cancel previous reconnect task if exists
            if participant.reconnect_task:
                participant.reconnect_task.cancel()

            # Create new reconnect timeout task
            async def handle_timeout() -> None:
                try:
                    await asyncio.sleep(settings.reconnect_timeout_seconds)

                    # Import here to avoid circular import
                    from datetime import datetime, timezone
                    from sqlalchemy import select
                    from app.config.database import session_scope
                    from app.models import Participant, ParticipantStatus

                    # Update database status to LEFT
                    async with session_scope() as session:
                        result = await session.execute(
                            select(Participant).where(Participant.id == participant_db_id)
                        )
                        db_participant = result.scalar_one_or_none()
                        if db_participant:
                            db_participant.connection_status = ParticipantStatus.LEFT.value
                            db_participant.left_at = datetime.now(tz=timezone.utc)
                            db_participant.reconnect_deadline = None
                            await session.commit()

                    # Remove from room and broadcast
                    await self.remove_participant(user_id)
                    await self.broadcast(
                        {"type": "user_left", "user": participant.user, "reason": "reconnect_timeout"},
                        sender_id=user_id,
                    )

                    logger.info(
                        "Reconnect timeout for user %s in call %s",
                        user_id,
                        self.call_id,
                    )
                except asyncio.CancelledError:
                    logger.debug("Reconnect timer cancelled for user %s in call %s", user_id, self.call_id)

            participant.reconnect_task = asyncio.create_task(handle_timeout())

        logger.info(
            "User %s marked as reconnecting in call %s (timeout: %s seconds)",
            user_id,
            self.call_id,
            settings.reconnect_timeout_seconds,
        )

    async def cancel_reconnect_timer(self, user_id: int) -> None:
        """Cancel reconnect timer for a participant."""

        async with self._lock:
            participant = self._participants.get(user_id)
            if participant:
                if participant.reconnect_task:
                    participant.reconnect_task.cancel()
                    participant.reconnect_task = None
                participant.is_reconnecting = False

        logger.info("Reconnect timer cancelled for user %s in call %s", user_id, self.call_id)

    async def list_participants(self, *, exclude_user_id: int | None = None) -> list[dict[str, Any]]:
        """Return serialized user payloads for all connected participants."""

        async with self._lock:
            return [
                connection.user
                for user_id, connection in self._participants.items()
                if exclude_user_id is None or user_id != exclude_user_id
            ]

    async def broadcast(
        self,
        message: dict[str, Any],
        *,
        sender_id: int | None = None,
        target_id: int | None = None,
    ) -> None:
        """Send a message to recipients.

        By default the message is sent to all participants except the sender. When
        ``target_id`` is provided, only that participant will receive the message.
        """

        async with self._lock:
            if target_id is not None:
                recipient = self._participants.get(target_id)
                recipients: list[tuple[int, ParticipantConnection]] = (
                    [(target_id, recipient)] if recipient else []
                )
            else:
                recipients = list(self._participants.items())

        disconnected_users: list[int] = []
        logger.debug(
            "Broadcasting message in call %s (type=%s sender=%s target=%s recipients=%s)",
            self.call_id,
            message.get("type"),
            sender_id,
            target_id,
            [user_id for user_id, _ in recipients],
        )
        for user_id, connection in recipients:
            if sender_id is not None and user_id == sender_id:
                continue

            try:
                await connection.websocket.send_json(message)
            except Exception:
                logger.exception(
                    "Failed to deliver message type=%s to user_id=%s in call %s",
                    message.get("type"),
                    user_id,
                    self.call_id,
                )
                disconnected_users.append(user_id)

        for user_id in disconnected_users:
            await self.remove_participant(user_id)


class CallRoomManager:
    """Maintain in-memory rooms for active call signaling."""

    def __init__(self) -> None:
        self._rooms: dict[str, CallRoom] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: asyncio.Task | None = None

    def start_cleanup_task(self) -> None:
        """Start background task for cleaning up stale empty rooms."""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_stale_rooms())
            logger.info("Started background task for cleaning up stale rooms")

    async def _cleanup_stale_rooms(self) -> None:
        """Background task that periodically cleans up empty rooms."""
        settings = get_settings()
        cleanup_interval_seconds = settings.empty_room_cleanup_minutes * 60

        logger.info(
            "Cleanup task started: will check for stale rooms every %s minutes",
            settings.empty_room_cleanup_minutes,
        )

        while True:
            try:
                await asyncio.sleep(cleanup_interval_seconds)
                now = time.time()

                async with self._lock:
                    stale_rooms = [
                        call_id
                        for call_id, room in self._rooms.items()
                        if room.is_empty and (now - room.last_activity) > cleanup_interval_seconds
                    ]

                    for call_id in stale_rooms:
                        self._rooms.pop(call_id, None)
                        logger.info("Cleaned up stale empty room: %s", call_id)

                    if stale_rooms:
                        logger.info(
                            "Cleanup completed: removed %s stale rooms, %s rooms remaining",
                            len(stale_rooms),
                            len(self._rooms),
                        )
            except asyncio.CancelledError:
                logger.info("Cleanup task cancelled")
                break
            except Exception:
                logger.exception("Error in cleanup task, will retry")

    async def get_room(self, call_id: str) -> CallRoom:
        async with self._lock:
            room = self._rooms.get(call_id)
            if room is None:
                room = CallRoom(call_id)
                self._rooms[call_id] = room
                logger.info(
                    "Created new room for call %s (total rooms: %s)",
                    call_id,
                    len(self._rooms),
                )
            return room

    async def get_existing_room(self, call_id: str) -> CallRoom | None:
        async with self._lock:
            return self._rooms.get(call_id)

    async def cleanup_room(self, call_id: str) -> None:
        """Clean up a room if it's empty.

        Uses double-checked locking to prevent race conditions.
        """
        async with self._lock:
            room = self._rooms.get(call_id)
            # Двойная проверка: убеждаемся что комната все еще пустая
            if room and room.is_empty:
                # Проверяем что это та же самая комната (защита от race condition)
                if self._rooms.get(call_id) == room:
                    self._rooms.pop(call_id, None)
                    logger.info(
                        "Cleaned up empty room: %s (total rooms: %s)",
                        call_id,
                        len(self._rooms),
                    )


call_room_manager = CallRoomManager()


async def notify_call_ended(call_id: str, *, reason: str) -> None:
    """Broadcast call termination to participants and cleanup rooms."""

    room = await call_room_manager.get_existing_room(call_id)
    if room:
        logger.info("Sending call_ended to call %s: %s", call_id, reason)
        await room.broadcast({"type": "call_ended", "reason": reason})
        await call_room_manager.cleanup_room(call_id)
