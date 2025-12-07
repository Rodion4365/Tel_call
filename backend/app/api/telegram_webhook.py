"""Telegram Bot webhook handler for inline queries and commands."""

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_session, session_scope
from app.config.settings import get_settings
from app.models import Call, User
from app.services.telegram_bot import answer_inline_query

router = APIRouter(prefix="/api/telegram", tags=["Telegram"])
logger = logging.getLogger(__name__)


class TelegramUpdate(BaseModel):
    """Telegram update model."""

    update_id: int
    message: dict[str, Any] | None = None
    inline_query: dict[str, Any] | None = None

    model_config = {"extra": "allow"}


@router.post("/webhook")
async def telegram_webhook(
    update: TelegramUpdate,
) -> dict[str, bool]:
    """Handle incoming Telegram updates (inline queries, messages, etc.)."""

    logger.info("Received Telegram update: %s", update.update_id)

    # Обработка inline query (для кнопки "Поделиться")
    if update.inline_query:
        await handle_inline_query(update.inline_query)
        return {"ok": True}

    # Обработка обычных сообщений (для команды /start)
    if update.message:
        await handle_message(update.message)
        return {"ok": True}

    logger.warning("Unknown update type: %s", update.model_dump())
    return {"ok": True}


async def handle_inline_query(inline_query: dict[str, Any]) -> None:
    """Handle inline query for sharing call with button."""

    query = inline_query.get("query", "").strip()
    inline_query_id = inline_query.get("id")
    from_user = inline_query.get("from", {})

    logger.info(
        "Inline query from user %s: %s",
        from_user.get("id"),
        query,
    )

    # Проверяем формат query: должен быть "call_{call_id}"
    if not query.startswith("call_"):
        # Возвращаем пустой результат
        await answer_inline_query(inline_query_id, [])
        return

    call_id = query.replace("call_", "")

    # Проверяем, существует ли звонок
    async with session_scope() as db_session:
        result = await db_session.execute(select(Call).where(Call.call_id == call_id))
        call = result.scalar_one_or_none()

    if not call:
        logger.warning("Call not found for inline query: %s", call_id)
        await answer_inline_query(inline_query_id, [])
        return

    # Формируем имя пользователя для сообщения
    caller_name = from_user.get("first_name") or from_user.get("username") or "Кто-то"

    # Формируем URL для подключения к звонку
    settings = get_settings()
    bot_username = settings.bot_username.lstrip("@")
    join_url = f"https://t.me/{bot_username}?startapp={call_id}"

    # Создаём результат inline query с кнопкой
    results = [
        {
            "type": "article",
            "id": f"call_{call_id}",
            "title": f"{caller_name} приглашает в звонок",
            "description": "Нажмите, чтобы отправить приглашение",
            "input_message_content": {
                "message_text": f"{caller_name} приглашает вас в звонок!",
            },
            "reply_markup": {
                "inline_keyboard": [
                    [
                        {
                            "text": "Присоединиться к звонку 📞",
                            "url": join_url,
                        }
                    ]
                ]
            },
        }
    ]

    await answer_inline_query(inline_query_id, results)


async def handle_message(message: dict[str, Any]) -> None:
    """Handle incoming messages (e.g., /start command)."""

    text = message.get("text", "")
    from_user = message.get("from", {})
    telegram_user_id = from_user.get("id")

    if not telegram_user_id:
        return

    # Обработка команды /start
    if text.startswith("/start"):
        await register_or_update_user(from_user)


async def register_or_update_user(telegram_user: dict[str, Any]) -> None:
    """Register new user or update existing user data."""

    telegram_user_id = telegram_user.get("id")
    username = telegram_user.get("username")
    first_name = telegram_user.get("first_name")
    last_name = telegram_user.get("last_name")

    if not telegram_user_id:
        return

    async with session_scope() as db_session:
        # Проверяем, существует ли пользователь
        result = await db_session.execute(
            select(User).where(User.telegram_user_id == telegram_user_id)
        )
        user = result.scalar_one_or_none()

        if user:
            # Обновляем данные существующего пользователя
            user.username = username
            user.first_name = first_name
            user.last_name = last_name
            logger.info("Updated user data for telegram_user_id=%s", telegram_user_id)
        else:
            # Создаём нового пользователя
            user = User(
                telegram_user_id=telegram_user_id,
                username=username,
                first_name=first_name,
                last_name=last_name,
            )
            db_session.add(user)
            logger.info("Registered new user telegram_user_id=%s", telegram_user_id)

        await db_session.commit()
