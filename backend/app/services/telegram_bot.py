"""Service for sending Telegram bot notifications."""

import logging
from typing import Any

import httpx

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


async def get_webhook_info() -> dict[str, Any] | None:
    """Return Telegram webhook info or None on failure."""

    settings = get_settings()

    if not settings.bot_token:
        logger.error("BOT_TOKEN is not configured, cannot fetch webhook info")
        return None

    api_url = f"https://api.telegram.org/bot{settings.bot_token}/getWebhookInfo"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(api_url, timeout=10.0)
            response.raise_for_status()
            payload = response.json()

            if payload.get("ok"):
                return payload.get("result", {})

            logger.error("Failed to fetch webhook info: %s", payload)
            return None

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Failed to fetch webhook info: HTTP %s - %s",
            exc.response.status_code,
            exc.response.text,
        )
        return None

    except httpx.RequestError as exc:
        logger.error("Failed to fetch webhook info: %s", str(exc))
        return None

    except Exception as exc:
        logger.exception("Unexpected error fetching webhook info: %s", str(exc))
        return None


async def log_webhook_status() -> None:
    """Log current webhook status to help diagnose missing replies."""

    info = await get_webhook_info()

    if not info:
        logger.warning(
            "Could not retrieve Telegram webhook info; the bot may not receive updates."
        )
        return

    url = info.get("url") or ""

    if not url:
        logger.warning(
            "Telegram webhook is not configured. The bot will not receive /start or /help commands."
        )
    else:
        logger.info("Telegram webhook configured: %s", url)
        logger.info(
            "Pending updates: %s, last error: %s",
            info.get("pending_update_count", 0),
            info.get("last_error_message"),
        )


async def answer_inline_query(
    inline_query_id: str, results: list[dict[str, Any]], cache_time: int = 300
) -> bool:
    """
    Answer an inline query with results.

    Args:
        inline_query_id: Unique identifier for the inline query
        results: List of inline query results
        cache_time: Time in seconds to cache results (default 300)

    Returns:
        True if successful, False otherwise
    """
    settings = get_settings()

    if not settings.bot_token:
        logger.error("BOT_TOKEN is not configured, cannot answer inline query")
        return False

    api_url = f"https://api.telegram.org/bot{settings.bot_token}/answerInlineQuery"

    payload: dict[str, Any] = {
        "inline_query_id": inline_query_id,
        "results": results,
        "cache_time": cache_time,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(api_url, json=payload, timeout=10.0)
            response.raise_for_status()

            logger.info("Successfully answered inline query %s", inline_query_id)
            return True

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Failed to answer inline query %s: HTTP %s - %s",
            inline_query_id,
            exc.response.status_code,
            exc.response.text,
        )
        return False

    except httpx.RequestError as exc:
        logger.error(
            "Failed to answer inline query %s: %s",
            inline_query_id,
            str(exc),
        )
        return False

    except Exception as exc:
        logger.exception(
            "Unexpected error answering inline query %s: %s",
            inline_query_id,
            str(exc),
        )
        return False




async def send_call_notification(
    telegram_user_id: int, caller_name: str, call_id: str
) -> bool:
    """
    Send a call notification to a Telegram user via bot message.

    Args:
        telegram_user_id: Telegram user ID to send notification to
        caller_name: Name of the person calling
        call_id: ID of the call to join

    Returns:
        True if notification was sent successfully, False otherwise
    """
    settings = get_settings()

    if not settings.bot_token:
        logger.error("BOT_TOKEN is not configured, cannot send notification")
        return False

    if not settings.bot_username:
        logger.error("BOT_USERNAME is not configured, cannot send notification")
        return False

    # Формируем текст сообщения
    text = f"Вам звонит {caller_name}"

    # Убираем @ из имени бота, если он есть
    bot_username = settings.bot_username.lstrip("@")

    # Формируем URL для подключения к звонку
    # Используем прямой URL к Mini App с параметром startapp
    join_url = f"https://t.me/{bot_username}?startapp={call_id}"

    # Формируем inline-кнопку с типом web_app для открытия Mini App
    inline_keyboard = {
        "inline_keyboard": [
            [{"text": "Принять звонок", "url": join_url}]
        ]
    }

    # Отправляем сообщение через Telegram Bot API
    api_url = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"

    payload: dict[str, Any] = {
        "chat_id": telegram_user_id,
        "text": text,
        "reply_markup": inline_keyboard,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(api_url, json=payload, timeout=10.0)
            response.raise_for_status()

            logger.info(
                "Successfully sent call notification to user %s for call %s",
                telegram_user_id,
                call_id,
            )
            return True

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Failed to send notification to user %s: HTTP %s - %s",
            telegram_user_id,
            exc.response.status_code,
            exc.response.text,
        )
        return False

    except httpx.RequestError as exc:
        logger.error(
            "Failed to send notification to user %s: %s",
            telegram_user_id,
            str(exc),
        )
        return False

    except Exception as exc:
        logger.exception(
            "Unexpected error sending notification to user %s: %s",
            telegram_user_id,
            str(exc),
        )
        return False
