"""Configuration endpoints for frontend clients."""

from fastapi import APIRouter

from app.config.settings import get_settings


router = APIRouter(prefix="/config", tags=["config"])


@router.get("/webrtc")
def get_webrtc_config() -> dict[str, list[str]]:
    """Expose STUN/TURN configuration without leaking credentials."""

    settings = get_settings()
    return {
        "stun_servers": settings.stun_servers,
        "turn_servers": settings.turn_servers,
    }
