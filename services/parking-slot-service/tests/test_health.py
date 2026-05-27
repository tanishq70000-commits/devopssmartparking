
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Patch db and redis before importing app
import asyncpg, redis.asyncio as aioredis

with patch("asyncpg.create_pool", new_callable=AsyncMock) as mock_pool, \
     patch("redis.asyncio.from_url") as mock_redis:

    mock_pool.return_value = AsyncMock()
    mock_redis.return_value = AsyncMock()

    from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert data["service"] == "parking-slot-service"
