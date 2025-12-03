import json
import time
import urllib.parse
import hmac
import hashlib

import pytest
from fastapi import HTTPException, status

from app.services.auth import validate_init_data


def build_init_data(bot_token: str, user_payload: dict[str, str], auth_date: int | None = None) -> str:
    auth_timestamp = auth_date or int(time.time())
    data: dict[str, str] = {
        "auth_date": str(auth_timestamp),
        "query_id": "AAEAAAEAAAEAAAEAAAEAAAEAAAE",
        "user": json.dumps(user_payload, separators=(",", ":")),
    }

    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(data.items()))
    secret_key = hmac.new(bot_token.encode(), b"WebAppData", hashlib.sha256).digest()
    data["hash"] = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    return urllib.parse.urlencode(data)


def test_validate_init_data_accepts_valid_signature():
    bot_token = "123456:TEST-TOKEN"
    user_payload = {"id": 42, "first_name": "Test", "username": "tester"}
    init_data = build_init_data(bot_token, user_payload)

    assert validate_init_data(init_data, bot_token=bot_token) == user_payload


def test_validate_init_data_rejects_tampered_payload():
    bot_token = "123456:TEST-TOKEN"
    user_payload = {"id": 42, "first_name": "Test", "username": "tester"}
    init_data = build_init_data(bot_token, user_payload)

    parsed = dict(urllib.parse.parse_qsl(init_data))
    parsed["user"] = json.dumps({"id": 42, "first_name": "Evil"})
    tampered_init_data = urllib.parse.urlencode(parsed)

    with pytest.raises(HTTPException) as excinfo:
        validate_init_data(tampered_init_data, bot_token=bot_token)

    assert excinfo.value.status_code == status.HTTP_401_UNAUTHORIZED
