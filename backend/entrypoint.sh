#!/bin/bash
set -e

echo "Checking database migration status..."

# Check if alembic_version table exists and has a version
CURRENT_VERSION=$(python3 -c "
import asyncio
from sqlalchemy import text
from app.config.database import async_engine

async def check_version():
    try:
        async with async_engine.connect() as conn:
            result = await conn.execute(text('SELECT version_num FROM alembic_version LIMIT 1'))
            version = result.scalar()
            print(version if version else '')
    except Exception:
        print('')

asyncio.run(check_version())
" 2>/dev/null || echo "")

if [ -z "$CURRENT_VERSION" ]; then
    echo "No alembic version found. Stamping database with c7a3d9e12f8b..."
    alembic stamp c7a3d9e12f8b
fi

echo "Running database migrations..."
alembic upgrade head

echo "Starting application..."
exec "$@"
