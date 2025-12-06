"""Service for sending Telegram bot notifications."""

import logging
from typing import Any

import httpx

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


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
    join_url = f"https://t.me/{bot_username}/app?startapp={call_id}"

    # Формируем inline-кнопку
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
