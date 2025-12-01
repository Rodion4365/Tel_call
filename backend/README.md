# Backend

## Stack
- Python 3.11+
- FastAPI
- SQLAlchemy (async) + asyncpg
- Uvicorn (ASGI server)

## Local development
1. Create and activate a virtual environment.
2. Copy `.env.example` to `.env` and update credentials.
3. Install dependencies: `pip install -r requirements.txt`.
4. Run the server: `make run` (uses `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`).

### Health check
- `GET /health` returns `{ "status": "ok" }` when the service is healthy.

## Project layout
- `app/main.py` — application entrypoint and router mounting.
- `app/api/` — API routers (e.g., `health.py`).
- `app/config/` — configuration and database setup.
- `app/models/` — SQLAlchemy models (placeholders for now).
- `app/services/` — business logic and integrations.
- `app/tasks/` — standalone maintenance commands (e.g., call expiration cleanup).
- `.env.example` — sample configuration.
- `Makefile` — helper commands (`make run`, `make test`).
- `requirements.txt` — dependency list for the service runtime.

## Maintenance jobs
- Auto-expire stale calls by running `python -m app.tasks.expire_calls` (suitable for cron/beat). This marks overdue calls as `expired` and notifies connected participants with a `call_ended` WebSocket event.
