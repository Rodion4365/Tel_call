import pytest


@pytest.mark.asyncio
async def test_get_webrtc_config(client):
    """Test GET /api/config/webrtc returns STUN/TURN configuration."""
    response = await client.get("/api/config/webrtc")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "stun_servers" in data
    assert "turn_servers" in data
    assert isinstance(data["stun_servers"], list)
    assert isinstance(data["turn_servers"], list)
