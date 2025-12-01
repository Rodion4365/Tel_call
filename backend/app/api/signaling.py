from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from app.config.database import get_session
from app.models import Call, CallStatus, User
from app.services.auth import get_user_from_token
from app.services.signaling import call_room_manager

router = APIRouter()


def _extract_token(websocket: WebSocket) -> str | None:
    token = websocket.query_params.get("token")
    if token:
        return token

    auth_header = websocket.headers.get("authorization") or websocket.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1]

    return None


def _serialize_user(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


async def _ensure_active_call(call_id: str) -> Call | None:
    async with get_session() as session:
        result = await session.execute(select(Call).where(Call.call_id == call_id))
        call = result.scalar_one_or_none()

    if not call:
        return None

    if call.expires_at and call.expires_at < datetime.utcnow():
        return None

    if call.status != CallStatus.ACTIVE:
        return None

    return call


@router.websocket("/ws/calls/{call_id}")
async def call_signaling(websocket: WebSocket, call_id: str) -> None:
    """WebSocket endpoint for relaying WebRTC signaling messages."""

    token = _extract_token(websocket)
    if not token:
        await websocket.close(code=4401, reason="Missing authentication token")
        return

    async with get_session() as session:
        try:
            user = await get_user_from_token(token, session)
        except HTTPException as exc:  # Authentication or token validation errors
            close_code = 4401 if exc.status_code == status.HTTP_401_UNAUTHORIZED else 1011
            await websocket.close(code=close_code, reason=str(exc.detail))
            return
        except Exception:
            await websocket.close(code=1011, reason="Authentication failed")
            return

    call = await _ensure_active_call(call_id)
    if call is None:
        await websocket.close(code=4404, reason="Call is not available")
        return

    await websocket.accept()
    room = await call_room_manager.get_room(call_id)
    await room.add_participant(user.id, websocket)
    await room.broadcast({"type": "user_joined", "user": _serialize_user(user)}, sender_id=user.id)

    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            if message_type in {"offer", "answer", "ice_candidate"}:
                await room.broadcast(
                    {
                        "type": message_type,
                        "payload": message.get("payload"),
                        "from_user": _serialize_user(user),
                    },
                    sender_id=user.id,
                )
            else:
                await websocket.send_json({"type": "error", "detail": "Unsupported message type"})
    except WebSocketDisconnect:
        pass
    finally:
        await room.remove_participant(user.id)
        await room.broadcast({"type": "user_left", "user": _serialize_user(user)}, sender_id=user.id)
        await call_room_manager.cleanup_room(call_id)
