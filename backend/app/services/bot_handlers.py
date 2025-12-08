"""Telegram bot command handlers using aiogram."""

import logging
from typing import Any

from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import session_scope
from app.config.settings import get_settings
from app.models import User

logger = logging.getLogger(__name__)

# Создаем экземпляры Bot и Dispatcher
settings = get_settings()
bot = Bot(token=settings.bot_token)
dp = Dispatcher()


async def register_or_update_user(telegram_user: types.User) -> None:
    """Register new user or update existing user data."""

    telegram_user_id = telegram_user.id
    username = telegram_user.username
    first_name = telegram_user.first_name
    last_name = telegram_user.last_name

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


@dp.message(Command("start"))
async def cmd_start(message: types.Message) -> None:
    """
    Handler for /start command.
    ТЗ 3: Приветственное сообщение на команду /start
    """
    logger.info("[cmd_start] Received /start command from user_id=%s", message.from_user.id)

    # Регистрируем или обновляем пользователя
    await register_or_update_user(message.from_user)

    # Убираем @ и пробелы из имени бота
    bot_username = settings.bot_username.strip().lstrip("@").strip()

    if not bot_username:
        logger.error("[cmd_start] BOT_USERNAME is empty after cleaning")
        await message.answer("Произошла ошибка при обработке команды.")
        return

    # ТЗ 3: Текст приветственного сообщения
    text = """Добро пожаловать в Call with bot!
Теперь вы сможете создавать звонки и разговаривать в Telegram."""

    # Формируем URL для открытия mini app
    mini_app_url = f"https://t.me/{bot_username}/app"

    logger.info("[cmd_start] Sending welcome message with mini_app_url=%s", mini_app_url)

    # Создаем inline-кнопку
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Открыть приложение", url=mini_app_url)]
    ])

    try:
        await message.answer(text, reply_markup=keyboard)
        logger.info("[cmd_start] Successfully sent welcome message to user_id=%s", message.from_user.id)
    except Exception as e:
        logger.exception("[cmd_start] Failed to send welcome message: %s", str(e))


@dp.message(Command("help"))
async def cmd_help(message: types.Message) -> None:
    """
    Handler for /help command.
    ТЗ 4: Обработка команды /help
    """
    logger.info("[cmd_help] Received /help command from user_id=%s", message.from_user.id)

    # ТЗ 4: Текст сообщения о поддержке
    text = """Если вы столкнулись с проблемами при работе бота, напишите нам: @call_with_support

Ваше обращение будет рассмотрено в течение 24 часов."""

    try:
        await message.answer(text)
        logger.info("[cmd_help] Successfully sent help message to user_id=%s", message.from_user.id)
    except Exception as e:
        logger.exception("[cmd_help] Failed to send help message: %s", str(e))


def get_bot() -> Bot:
    """Get bot instance."""
    return bot


def get_dispatcher() -> Dispatcher:
    """Get dispatcher instance."""
    return dp
