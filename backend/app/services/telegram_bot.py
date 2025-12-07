"""Service for sending Telegram bot notifications."""

import logging
from typing import Any

import httpx

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


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


async def send_welcome_message(telegram_user_id: int, first_name: str | None = None) -> bool:
    """
    Send welcome message with mini app button.

    Args:
        telegram_user_id: Telegram user ID to send message to
        first_name: User's first name for personalization

    Returns:
        True if successful, False otherwise
    """
    settings = get_settings()

    if not settings.bot_token:
        logger.error("BOT_TOKEN is not configured, cannot send welcome message")
        return False

    if not settings.bot_username:
        logger.error("BOT_USERNAME is not configured, cannot send welcome message")
        return False

    # ТЗ 3: Приветственное сообщение на команду /start
    text = """Добро пожаловать в Call with bot!
Теперь вы сможете создавать звонки и разговаривать в Telegram."""

    # Убираем @ из имени бота, если он есть
    bot_username = settings.bot_username.lstrip("@")

    # Формируем URL для открытия mini app
    mini_app_url = f"https://t.me/{bot_username}/app"

    # Формируем inline-кнопку для открытия mini app
    inline_keyboard = {
        "inline_keyboard": [
            [{"text": "Открыть приложение", "url": mini_app_url}]
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

            logger.info("Successfully sent welcome message to user %s", telegram_user_id)
            return True

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Failed to send welcome message to user %s: HTTP %s - %s",
            telegram_user_id,
            exc.response.status_code,
            exc.response.text,
        )
        return False

    except httpx.RequestError as exc:
        logger.error(
            "Failed to send welcome message to user %s: %s",
            telegram_user_id,
            str(exc),
        )
        return False

    except Exception as exc:
        logger.exception(
            "Unexpected error sending welcome message to user %s: %s",
            telegram_user_id,
            str(exc),
        )
        return False


async def send_help_message(telegram_user_id: int) -> bool:
    """
    Send help message to user.

    Args:
        telegram_user_id: Telegram user ID to send message to

    Returns:
        True if successful, False otherwise
    """
    settings = get_settings()

    if not settings.bot_token:
        logger.error("BOT_TOKEN is not configured, cannot send help message")
        return False

    # ТЗ 4: Обработка команды /help
    text = """Если вы столкнулись с проблемами при работе бота, напишите нам: @call_with_support

Ваше обращение будет рассмотрено в течение 24 часов."""

    # Отправляем сообщение через Telegram Bot API
    api_url = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"

    payload: dict[str, Any] = {
        "chat_id": telegram_user_id,
        "text": text,
        "parse_mode": "Markdown",  # Для поддержки кликабельной ссылки @call_with_support
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(api_url, json=payload, timeout=10.0)
            response.raise_for_status()

            logger.info("Successfully sent help message to user %s", telegram_user_id)
            return True

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Failed to send help message to user %s: HTTP %s - %s",
            telegram_user_id,
            exc.response.status_code,
            exc.response.text,
        )
        return False

    except httpx.RequestError as exc:
        logger.error(
            "Failed to send help message to user %s: %s",
            telegram_user_id,
            str(exc),
        )
        return False

    except Exception as exc:
        logger.exception(
            "Unexpected error sending help message to user %s: %s",
            telegram_user_id,
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
