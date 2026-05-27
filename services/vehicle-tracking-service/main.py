import os, json, asyncio
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
import asyncpg
import redis.asyncio as aioredis

app = FastAPI(title="Vehicle Tracking Service")

DB_URL    = os.getenv("DATABASE_URL", "postgresql://smartparking:smartparking_db_pass@postgres:5432/smartparking")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

pool = None
redis_client = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active_connections:
            self.active_connections.remove(ws)

    async def broadcast(self, message: dict):
        data = json.dumps(message, default=str)
        dead = []
        for ws in self.active_connections:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()

@app.on_event("startup")
async def startup():
    global pool, redis_client
    pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=10)
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    async with pool.acquire() as conn:
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS vehicle_locations ("
            "id SERIAL PRIMARY KEY,"
            "vehicle_number VARCHAR(20) NOT NULL,"
            "latitude FLOAT NOT NULL,"
            "longitude FLOAT NOT NULL,"
            "speed FLOAT DEFAULT 0,"
            "slot_number INT,"
            "status VARCHAR(20) DEFAULT 'moving',"
            "recorded_at TIMESTAMP DEFAULT NOW())"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_vehicle_number ON vehicle_locations(vehicle_number)"
        )

@app.on_event("shutdown")
async def shutdown():
    await pool.close()
    await redis_client.close()

@app.get("/health")
def health():
    return {"status": "UP", "service": "vehicle-tracking-service",
            "active_ws_connections": len(manager.active_connections)}

# ── WebSocket endpoint for real-time tracking ─────────────────────────────────
@app.websocket("/ws/track/{vehicle_number}")
async def websocket_track(websocket: WebSocket, vehicle_number: str):
    await manager.connect(websocket)
    try:
        while True:
            # Fetch latest position from Redis cache (5s TTL)
            cached = await redis_client.get(f"location:{vehicle_number}")
            if cached:
                await websocket.send_text(cached)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ── REST endpoints ────────────────────────────────────────────────────────────
class LocationUpdate(BaseModel):
    vehicle_number: str
    latitude: float
    longitude: float
    speed: Optional[float] = 0.0
    slot_number: Optional[int] = None
    status: Optional[str] = "moving"

@app.post("/locations")
async def update_location(data: LocationUpdate):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO vehicle_locations (vehicle_number, latitude, longitude, speed, slot_number, status) "
            "VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            data.vehicle_number.upper(), data.latitude, data.longitude,
            data.speed, data.slot_number, data.status
        )
    payload = dict(row)
    # Cache latest position in Redis
    await redis_client.setex(
        f"location:{data.vehicle_number.upper()}", 30,
        json.dumps(payload, default=str)
    )
    # Broadcast to all WebSocket subscribers
    await manager.broadcast({"event": "location_update", "data": payload})
    return {"message": "Location updated", "location": payload}

@app.get("/locations/{vehicle_number}/latest")
async def get_latest(vehicle_number: str):
    cached = await redis_client.get(f"location:{vehicle_number.upper()}")
    if cached:
        return json.loads(cached)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM vehicle_locations WHERE vehicle_number = $1 ORDER BY recorded_at DESC LIMIT 1",
            vehicle_number.upper()
        )
    if not row:
        raise HTTPException(404, f"No location data for {vehicle_number}")
    return dict(row)

@app.get("/locations/{vehicle_number}/history")
async def get_history(vehicle_number: str, limit: int = 50):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT latitude, longitude, speed, status, recorded_at FROM vehicle_locations "
            "WHERE vehicle_number = $1 ORDER BY recorded_at DESC LIMIT $2",
            vehicle_number.upper(), limit
        )
    return {"vehicle_number": vehicle_number.upper(), "history": [dict(r) for r in rows]}

@app.get("/locations/active")
async def get_active_vehicles():
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT DISTINCT ON (vehicle_number) vehicle_number, latitude, longitude, speed, status, recorded_at "
            "FROM vehicle_locations WHERE recorded_at > NOW() - INTERVAL '10 minutes' "
            "ORDER BY vehicle_number, recorded_at DESC"
        )
    return {"active_vehicles": len(rows), "vehicles": [dict(r) for r in rows]}
