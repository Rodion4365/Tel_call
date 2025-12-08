from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket


logger = logging.getLogger("app.webrtc")


@dataclass
class ParticipantConnection:
    """Represents a participant connection and metadata."""

    websocket: WebSocket
    user: dict[str, Any]


class CallRoom:
    """Manage WebSocket participants for a specific call."""

    def __init__(self, call_id: str) -> None:
        self.call_id = call_id
        self._participants: dict[int, ParticipantConnection] = {}
        self._lock = asyncio.Lock()
        # Время начала комнаты (когда первый участник вошел)
        self.start_time = datetime.now(tz=timezone.utc)

    @property
    def is_empty(self) -> bool:
        return not self._participants

    async def add_participant(self, user_id: int, websocket: WebSocket, user: dict[str, Any]) -> None:
        """Register a connected user in the room."""

        async with self._lock:
            self._participants[user_id] = ParticipantConnection(websocket, user)

        logger.info(
            "User %s joined call %s (participants=%s)",
            user_id,
            self.call_id,
            len(self._participants),
        )

    async def remove_participant(self, user_id: int) -> None:
        """Remove a user from the room if present."""

        async with self._lock:
            self._participants.pop(user_id, None)

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

    async def get_room(self, call_id: str) -> CallRoom:
        async with self._lock:
            room = self._rooms.get(call_id)
            if room is None:
                room = CallRoom(call_id)
                self._rooms[call_id] = room
            return room

    async def get_existing_room(self, call_id: str) -> CallRoom | None:
        async with self._lock:
            return self._rooms.get(call_id)

    async def cleanup_room(self, call_id: str) -> None:
        async with self._lock:
            room = self._rooms.get(call_id)
            if room and room.is_empty:
                self._rooms.pop(call_id, None)


call_room_manager = CallRoomManager()


async def notify_call_ended(call_id: str, *, reason: str) -> None:
    """Broadcast call termination to participants and cleanup rooms."""

    room = await call_room_manager.get_existing_room(call_id)
    if room:
        logger.info("Sending call_ended to call %s: %s", call_id, reason)
        await room.broadcast({"type": "call_ended", "reason": reason})
        await call_room_manager.cleanup_room(call_id)
