"""Telegram Bot webhook handler for inline queries and commands."""

import logging
from typing import Any

from aiogram.types import Update
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.config.database import session_scope
from app.config.settings import get_settings
from app.models import Call
from app.services.bot_handlers import get_bot, get_dispatcher
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
    logger.info("Update content: message=%s, inline_query=%s",
                bool(update.message), bool(update.inline_query))

    # Обработка inline query (для кнопки "Поделиться")
    if update.inline_query:
        logger.info("Processing inline query")
        await handle_inline_query(update.inline_query)
        return {"ok": True}

    # Обработка всех остальных updates через aiogram dispatcher
    # Это включает команды /start, /help и другие сообщения
    bot = get_bot()
    dp = get_dispatcher()

    # Конвертируем pydantic модель в aiogram Update
    aiogram_update = Update(**update.model_dump())

    try:
        await dp.feed_update(bot=bot, update=aiogram_update)
        logger.info("Successfully processed update through aiogram dispatcher")
    except Exception as e:
        logger.exception("Error processing update through aiogram: %s", str(e))

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
            "title": f'Звонок от "{caller_name}"',
            "description": "Нажмите, чтобы отправить приглашение",
            "input_message_content": {
                "message_text": f'Звонок от "{caller_name}"\nПрисоединиться к звонку:',
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


