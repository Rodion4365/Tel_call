"""TURN server health check service."""

import asyncio
import logging
import socket
from typing import NamedTuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class TurnServerStatus(NamedTuple):
    """TURN server health status."""

    url: str
    is_available: bool
    error: str | None = None


async def check_turn_server(url: str, timeout: float = 5.0) -> TurnServerStatus:
    """Check if a TURN server is reachable.

    Args:
        url: TURN server URL (e.g., "turn:example.com:3478")
        timeout: Connection timeout in seconds

    Returns:
        TurnServerStatus with availability info
    """
    try:
        parsed = urlparse(url if "://" in url else f"turn://{url}")
        host = parsed.hostname or parsed.path.split(":")[0]
        port = parsed.port or 3478  # Default TURN port

        if not host:
            return TurnServerStatus(url=url, is_available=False, error="Invalid URL format")

        # Try to connect to the TURN server port
        try:
            await asyncio.wait_for(
                asyncio.open_connection(host, port),
                timeout=timeout,
            )
            logger.info(f"TURN server {url} is reachable")
            return TurnServerStatus(url=url, is_available=True)

        except (asyncio.TimeoutError, TimeoutError):
            error_msg = f"Connection timeout after {timeout}s"
            logger.warning(f"TURN server {url} timeout: {error_msg}")
            return TurnServerStatus(url=url, is_available=False, error=error_msg)

        except (socket.gaierror, OSError) as e:
            error_msg = f"Connection failed: {str(e)}"
            logger.warning(f"TURN server {url} unreachable: {error_msg}")
            return TurnServerStatus(url=url, is_available=False, error=error_msg)

    except Exception as e:
        error_msg = f"Health check failed: {str(e)}"
        logger.error(f"TURN server {url} health check error: {error_msg}")
        return TurnServerStatus(url=url, is_available=False, error=error_msg)


async def check_all_turn_servers(urls: list[str], timeout: float = 5.0) -> list[TurnServerStatus]:
    """Check health of all TURN servers concurrently.

    Args:
        urls: List of TURN server URLs
        timeout: Connection timeout in seconds per server

    Returns:
        List of TurnServerStatus for each server
    """
    if not urls:
        return []

    tasks = [check_turn_server(url, timeout) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=False)

    return list(results)


def get_available_turn_servers(statuses: list[TurnServerStatus]) -> list[str]:
    """Filter available TURN servers from health check results.

    Args:
        statuses: List of TurnServerStatus

    Returns:
        List of available TURN server URLs
    """
    return [status.url for status in statuses if status.is_available]
