#!/usr/bin/env python3
"""
Скрипт для принудительного обновления Telegram webhook.
Использовать когда нужно изменить webhook URL.
"""

import asyncio
import sys

from app.config.settings import get_settings
from app.services.telegram_bot import set_webhook, get_webhook_info


async def main():
    """Принудительно обновить Telegram webhook."""
    settings = get_settings()

    if not settings.bot_webhook_url:
        print("❌ Ошибка: BOT_WEBHOOK_URL не установлен в .env")
        sys.exit(1)

    print("📋 Текущий webhook:")
    info = await get_webhook_info()
    if info:
        current_url = info.get("url", "не установлен")
        print(f"   {current_url}")
    else:
        print("   Не удалось получить информацию")

    print(f"\n🔄 Устанавливаю новый webhook:")
    print(f"   {settings.bot_webhook_url}")

    if await set_webhook(str(settings.bot_webhook_url)):
        print("\n✅ Webhook успешно обновлен!")

        # Проверка
        print("\n📋 Проверка нового webhook:")
        info = await get_webhook_info()
        if info:
            new_url = info.get("url", "не установлен")
            print(f"   {new_url}")
            if str(settings.bot_webhook_url) == new_url:
                print("\n🎉 Готово! Webhook обновлен корректно")
            else:
                print("\n⚠️  Внимание: URL не совпадает")
    else:
        print("\n❌ Ошибка при обновлении webhook")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
