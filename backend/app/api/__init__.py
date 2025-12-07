"""API routers for the application."""

from fastapi import APIRouter

from app.api import auth, call_stats, calls, config, friends, health, signaling, telegram_webhook


def get_api_router() -> APIRouter:
    """Construct and return the main API router."""

    router = APIRouter()
    router.include_router(auth.router)
    router.include_router(calls.router)
    router.include_router(call_stats.router)
    router.include_router(config.router)
    router.include_router(friends.router)
    router.include_router(health.router)
    router.include_router(signaling.router)
    router.include_router(telegram_webhook.router)
    return router
