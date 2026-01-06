#!/bin/bash
set -e

echo "Initializing database tables..."

# Create tables if they don't exist
python3 -c "
import asyncio
from app.config.database import Base, engine

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Database tables initialized successfully')

asyncio.run(init_db())
"

echo "Starting application..."
exec "$@"
