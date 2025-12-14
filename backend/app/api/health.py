from fastapi import APIRouter, status

router = APIRouter(tags=["Health"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check() -> dict[str, str]:
    """Simple health check endpoint."""

    return {"status": "ok"}


@router.get("/", status_code=status.HTTP_200_OK)
async def root() -> dict[str, str]:
    """Root endpoint used for uptime checks (returns 200 instead of 404)."""

    return {"status": "ok", "message": "Tel Call backend is running"}
