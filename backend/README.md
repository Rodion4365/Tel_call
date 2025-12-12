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

## WebRTC configuration
- Populate `STUN_SERVERS` and `TURN_SERVERS` (comma-separated) in `.env` to advertise ICE
  candidates that work behind NAT/firewalls.
- Clients can retrieve these hosts without credentials from `GET /config/webrtc`.

## Telegram Bot Setup

### Setting up the webhook
After deploying your backend, you need to configure the Telegram webhook:

```bash
# Set webhook (replace with your actual domain)
python -m app.tasks.set_webhook set https://yourdomain.com/api/telegram/webhook

# Check webhook status
python -m app.tasks.set_webhook info

# Delete webhook (if needed)
python -m app.tasks.set_webhook delete
```

**Important:**
- The webhook URL must be HTTPS (Telegram requires SSL)
- Make sure your `.env` file has `BOT_TOKEN` and `BOT_USERNAME` configured
- For local development, use ngrok or similar tool to expose your local server

### Testing bot commands locally with ngrok
```bash
# Install ngrok (https://ngrok.com/)
ngrok http 8000

# Use the HTTPS URL from ngrok to set webhook
python -m app.tasks.set_webhook set https://your-ngrok-url.ngrok.io/api/telegram/webhook
```

## Maintenance jobs
- Auto-expire stale calls by running `python -m app.tasks.expire_calls` (suitable for cron/beat). This marks overdue calls as `expired` and notifies connected participants with a `call_ended` WebSocket event.
