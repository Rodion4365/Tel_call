"""API routers for the application."""

from fastapi import APIRouter

from app.api import health


def get_api_router() -> APIRouter:
    """Construct and return the main API router."""

    router = APIRouter()
    router.include_router(health.router)
    return router
