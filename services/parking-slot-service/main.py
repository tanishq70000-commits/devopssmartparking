import os, json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncpg
import redis.asyncio as aioredis

app = FastAPI(title="Parking Slot Service")
DB_URL    = os.getenv("DATABASE_URL", "postgresql://smartparking:smartparking_db_pass@postgres:5432/smartparking")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

pool = None
redis_client = None

@app.on_event("startup")
async def startup():
    global pool, redis_client
    pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=10)
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    async with pool.acquire() as conn:
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS parking_slots ("
            "id SERIAL PRIMARY KEY, slot_number INT UNIQUE NOT NULL,"
            "is_occupied BOOLEAN DEFAULT FALSE, vehicle_number VARCHAR(20),"
            "updated_at TIMESTAMP DEFAULT NOW())"
        )
        count = await conn.fetchval("SELECT COUNT(*) FROM parking_slots")
        if count == 0:
            await conn.executemany(
                "INSERT INTO parking_slots (slot_number) VALUES ($1) ON CONFLICT DO NOTHING",
                [(i,) for i in range(1, 106)]
            )

@app.on_event("shutdown")
async def shutdown():
    await pool.close()
    await redis_client.close()

@app.get("/health")
def health():
    return {"status": "UP", "service": "parking-slot-service"}

@app.get("/slots")
async def get_all_slots():
    cached = await redis_client.get("slots:all")
    if cached:
        return json.loads(cached)
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT slot_number, is_occupied, vehicle_number FROM parking_slots ORDER BY slot_number")
    result = [dict(r) for r in rows]
    await redis_client.setex("slots:all", 5, json.dumps(result, default=str))
    return result

@app.get("/slots/available")
async def get_available():
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT slot_number FROM parking_slots WHERE is_occupied = FALSE ORDER BY slot_number")
    return {"available": [r["slot_number"] for r in rows], "count": len(rows)}

class SlotUpdate(BaseModel):
    vehicle_number: Optional[str] = None

@app.post("/slots/{slot_number}/occupy")
async def occupy_slot(slot_number: int, body: SlotUpdate):
    async with pool.acquire() as conn:
        slot = await conn.fetchrow("SELECT * FROM parking_slots WHERE slot_number=$1", slot_number)
        if not slot:
            raise HTTPException(404, "Slot not found")
        if slot["is_occupied"]:
            raise HTTPException(409, "Slot already occupied")
        await conn.execute(
            "UPDATE parking_slots SET is_occupied=TRUE, vehicle_number=$1, updated_at=NOW() WHERE slot_number=$2",
            body.vehicle_number, slot_number
        )
    await redis_client.delete("slots:all")
    return {"message": f"Slot {slot_number} is now occupied"}

@app.post("/slots/{slot_number}/release")
async def release_slot(slot_number: int):
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE parking_slots SET is_occupied=FALSE, vehicle_number=NULL, updated_at=NOW() WHERE slot_number=$1",
            slot_number
        )
    await redis_client.delete("slots:all")
    return {"message": f"Slot {slot_number} is now free"}
