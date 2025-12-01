# Backend

## Stack
- Python 3.11+
- FastAPI
- Uvicorn (ASGI server)

## Local development
1. Create and activate a virtual environment.
2. Install dependencies: `pip install -r requirements.txt`.
3. Run the server: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.

## Project layout
- `app/main.py` — entrypoint with a basic healthcheck endpoint.
- `requirements.txt` — minimal dependency list for the service runtime.
