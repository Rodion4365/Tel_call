from fastapi import FastAPI

app = FastAPI(title="Tel Call Backend")


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Simple health check endpoint."""
    return {"status": "ok"}
