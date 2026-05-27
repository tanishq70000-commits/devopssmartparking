
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

with patch("asyncpg.create_pool", new_callable=AsyncMock) as mock_pool, \
     patch("aio_pika.connect_robust", new_callable=AsyncMock):
    mock_pool.return_value = AsyncMock()
    from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert data["service"] == "analytics-service"
