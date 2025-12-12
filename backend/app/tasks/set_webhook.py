#!/usr/bin/env python3
"""Script to set up Telegram webhook for the bot."""

import asyncio
import logging
import sys

import httpx

from app.config.settings import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def set_webhook(webhook_url: str, bot_token: str) -> None:
    """Set webhook for the Telegram bot."""

    telegram_api_url = f"https://api.telegram.org/bot{bot_token}/setWebhook"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                telegram_api_url,
                json={"url": webhook_url},
                timeout=30.0,
            )
            response.raise_for_status()
            result = response.json()

            if result.get("ok"):
                logger.info("✅ Webhook successfully set to: %s", webhook_url)
                logger.info("Response: %s", result.get("description", ""))
            else:
                logger.error("❌ Failed to set webhook: %s", result)
                sys.exit(1)

        except httpx.HTTPError as e:
            logger.exception("❌ HTTP error while setting webhook: %s", str(e))
            sys.exit(1)


async def get_webhook_info(bot_token: str) -> None:
    """Get current webhook information."""

    telegram_api_url = f"https://api.telegram.org/bot{bot_token}/getWebhookInfo"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(telegram_api_url, timeout=30.0)
            response.raise_for_status()
            result = response.json()

            if result.get("ok"):
                info = result.get("result", {})
                logger.info("📋 Current webhook info:")
                logger.info("  URL: %s", info.get("url", "Not set"))
                logger.info("  Has custom certificate: %s", info.get("has_custom_certificate", False))
                logger.info("  Pending update count: %s", info.get("pending_update_count", 0))
                logger.info("  Last error date: %s", info.get("last_error_date", "None"))
                logger.info("  Last error message: %s", info.get("last_error_message", "None"))
            else:
                logger.error("❌ Failed to get webhook info: %s", result)

        except httpx.HTTPError as e:
            logger.exception("❌ HTTP error while getting webhook info: %s", str(e))


async def delete_webhook(bot_token: str) -> None:
    """Delete webhook for the Telegram bot."""

    telegram_api_url = f"https://api.telegram.org/bot{bot_token}/deleteWebhook"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(telegram_api_url, timeout=30.0)
            response.raise_for_status()
            result = response.json()

            if result.get("ok"):
                logger.info("✅ Webhook deleted successfully")
            else:
                logger.error("❌ Failed to delete webhook: %s", result)

        except httpx.HTTPError as e:
            logger.exception("❌ HTTP error while deleting webhook: %s", str(e))


async def main() -> None:
    """Main function to manage webhook."""

    settings = get_settings()

    if not settings.bot_token:
        logger.error("❌ BOT_TOKEN is not set in environment variables")
        sys.exit(1)

    # Parse command line arguments
    if len(sys.argv) < 2:
        logger.error("Usage:")
        logger.error("  python -m app.tasks.set_webhook set <webhook_url>")
        logger.error("  python -m app.tasks.set_webhook info")
        logger.error("  python -m app.tasks.set_webhook delete")
        logger.error("")
        logger.error("Example:")
        logger.error("  python -m app.tasks.set_webhook set https://yourdomain.com/api/telegram/webhook")
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "set":
        if len(sys.argv) < 3:
            logger.error("❌ Please provide webhook URL")
            logger.error("Example: python -m app.tasks.set_webhook set https://yourdomain.com/api/telegram/webhook")
            sys.exit(1)

        webhook_url = sys.argv[2]
        logger.info("Setting webhook to: %s", webhook_url)
        await set_webhook(webhook_url, settings.bot_token)

        # Show current webhook info after setting
        logger.info("")
        await get_webhook_info(settings.bot_token)

    elif command == "info":
        await get_webhook_info(settings.bot_token)

    elif command == "delete":
        await delete_webhook(settings.bot_token)

    else:
        logger.error("❌ Unknown command: %s", command)
        logger.error("Available commands: set, info, delete")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
