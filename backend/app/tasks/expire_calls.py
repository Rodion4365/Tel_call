from __future__ import annotations

import asyncio
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.config.database import session_scope
from app.models import Call, CallStatus
from app.services.signaling import notify_call_ended


async def expire_calls() -> int:
    """Mark calls as expired when their expiry timestamp has passed."""

    now = datetime.utcnow()
    async with session_scope() as session:
        result = await session.execute(
            select(Call).where(
                Call.status == CallStatus.ACTIVE,
                Call.expires_at.is_not(None),
                Call.expires_at < now,
            )
        )
        expiring_calls = result.scalars().all()

        if not expiring_calls:
            return 0

        for call in expiring_calls:
            call.status = CallStatus.EXPIRED

        try:
            await session.commit()
        except SQLAlchemyError:
            await session.rollback()
            raise

    for call in expiring_calls:
        await notify_call_ended(call.call_id, reason=CallStatus.EXPIRED.value)

    return len(expiring_calls)


async def main() -> None:
    expired_count = await expire_calls()
    print(f"Expired {expired_count} call(s)")


if __name__ == "__main__":
    asyncio.run(main())
