"""Configuration endpoints for frontend clients."""

from fastapi import APIRouter

from app.config.settings import get_settings


router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/webrtc")
def get_webrtc_config() -> dict[str, list[str] | list[dict[str, str]]]:
    """Expose STUN/TURN configuration for clients."""

    settings = get_settings()

    turn_servers: list[dict[str, str]] = []
    for server in settings.turn_servers:
        entry = {"url": server}

        if settings.turn_username and settings.turn_password:
            entry["username"] = settings.turn_username
            entry["credential"] = settings.turn_password

        turn_servers.append(entry)

    return {
        "stun_servers": settings.stun_servers,
        "turn_servers": turn_servers,
    }
