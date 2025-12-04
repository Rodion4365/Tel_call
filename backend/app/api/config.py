"""Configuration endpoints for frontend clients."""

import logging

from fastapi import APIRouter

from app.config.settings import get_settings
from app.services.turn_healthcheck import check_all_turn_servers, get_available_turn_servers


router = APIRouter(prefix="/api/config", tags=["config"])
logger = logging.getLogger(__name__)


@router.get("/webrtc")
async def get_webrtc_config() -> dict[str, list[str] | list[dict[str, str]]]:
    """Expose STUN/TURN configuration for clients with health-checked TURN servers."""

    settings = get_settings()

    # Health check TURN servers before returning them
    if settings.turn_servers:
        statuses = await check_all_turn_servers(settings.turn_servers, timeout=3.0)
        available_turn_urls = get_available_turn_servers(statuses)

        unavailable = len(settings.turn_servers) - len(available_turn_urls)
        if unavailable > 0:
            logger.warning(f"{unavailable} TURN server(s) are unavailable")
    else:
        available_turn_urls = []

    # Build TURN server config with credentials
    turn_servers: list[dict[str, str]] = []
    for server in available_turn_urls:
        entry = {"url": server}

        if settings.turn_username and settings.turn_password:
            entry["username"] = settings.turn_username
            entry["credential"] = settings.turn_password

        turn_servers.append(entry)

    return {
        "stun_servers": settings.stun_servers,
        "turn_servers": turn_servers,
    }
