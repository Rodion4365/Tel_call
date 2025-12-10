import logging

import pytest

from app.services.auth import get_or_create_user


@pytest.mark.asyncio
async def test_updates_first_name_and_username_when_changed(test_db):
    telegram_payload = {
        "id": 101,
        "username": "OldUser",
        "first_name": "Old",
        "last_name": "Last",
        "photo_url": "http://example.com/photo1.jpg",
    }

    user = await get_or_create_user(test_db, telegram_payload)

    updated_payload = {
        "id": 101,
        "username": "new_user",
        "first_name": "New",
        "last_name": "Last",
        "photo_url": "http://example.com/photo2.jpg",
    }

    updated_user = await get_or_create_user(test_db, updated_payload)

    assert updated_user.id == user.id
    assert updated_user.first_name == "New"
    assert updated_user.username == "new_user"
    assert updated_user.photo_url == "http://example.com/photo2.jpg"


@pytest.mark.asyncio
async def test_invalid_username_does_not_override_existing(test_db, caplog):
    caplog.set_level(logging.WARNING)

    telegram_payload = {
        "id": 202,
        "username": "validname",
        "first_name": "Alice",
    }

    user = await get_or_create_user(test_db, telegram_payload)

    updated_payload = {
        "id": 202,
        "username": "",  # invalid username should be ignored
        "first_name": "Alicia",
    }

    updated_user = await get_or_create_user(test_db, updated_payload)

    assert updated_user.id == user.id
    assert updated_user.first_name == "Alicia"
    assert updated_user.username == "validname"
    assert any("invalid Telegram username" in record.message for record in caplog.records)
