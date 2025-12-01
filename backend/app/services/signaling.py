from __future__ import annotations

import asyncio
from typing import Any

from fastapi import WebSocket


class CallRoom:
    """Manage WebSocket participants for a specific call."""

    def __init__(self, call_id: str) -> None:
        self.call_id = call_id
        self._participants: dict[int, WebSocket] = {}
        self._lock = asyncio.Lock()

    @property
    def is_empty(self) -> bool:
        return not self._participants

    async def add_participant(self, user_id: int, websocket: WebSocket) -> None:
        """Register a connected user in the room."""

        async with self._lock:
            self._participants[user_id] = websocket

    async def remove_participant(self, user_id: int) -> None:
        """Remove a user from the room if present."""

        async with self._lock:
            self._participants.pop(user_id, None)

    async def broadcast(self, message: dict[str, Any], *, sender_id: int | None = None) -> None:
        """Send a message to all participants except the sender (when provided)."""

        async with self._lock:
            recipients = list(self._participants.items())

        disconnected_users: list[int] = []
        for user_id, websocket in recipients:
            if sender_id is not None and user_id == sender_id:
                continue

            try:
                await websocket.send_json(message)
            except Exception:
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
        await room.broadcast({"type": "call_ended", "reason": reason})
        await call_room_manager.cleanup_room(call_id)
