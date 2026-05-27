import os, asyncio
from fastapi import FastAPI
import asyncpg, aio_pika

app = FastAPI(title="Analytics Service")
DB_URL = os.getenv("DATABASE_URL", "postgresql://smartparking:smartparking_db_pass@postgres:5432/smartparking")
MQ_URL = os.getenv("RABBITMQ_URL", "amqp://admin:smartparking_pass@rabbitmq:5672")
pool = None

@app.on_event("startup")
async def startup():
    global pool
    pool = await asyncpg.create_pool(DB_URL)
    async with pool.acquire() as conn:
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS analytics_events ("
            "id SERIAL PRIMARY KEY, event_type VARCHAR(100),"
            "payload JSONB, created_at TIMESTAMP DEFAULT NOW())"
        )
    asyncio.create_task(consume_events())

async def consume_events():
    try:
        conn = await aio_pika.connect_robust(MQ_URL)
        ch = await conn.channel()
        exchange = await ch.declare_exchange("parking_events", aio_pika.ExchangeType.TOPIC, durable=True)
        queue = await ch.declare_queue("analytics_queue", durable=True)
        await queue.bind(exchange, "#")
        async with queue.iterator() as q:
            async for msg in q:
                async with msg.process():
                    async with pool.acquire() as c:
                        await c.execute(
                            "INSERT INTO analytics_events (event_type, payload) VALUES ($1, $2::jsonb)",
                            msg.routing_key, msg.body.decode()
                        )
    except Exception as e:
        print(f"Consumer error: {e}")
        await asyncio.sleep(5)
        asyncio.create_task(consume_events())

@app.get("/health")
def health():
    return {"status": "UP", "service": "analytics-service"}

@app.get("/analytics/daily")
async def daily_summary():
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT DATE(created_at) as date, event_type, COUNT(*) as count "
            "FROM analytics_events WHERE created_at >= NOW() - INTERVAL '7 days' "
            "GROUP BY DATE(created_at), event_type ORDER BY date DESC"
        )
    return [dict(r) for r in rows]

@app.get("/analytics/revenue")
async def revenue():
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT DATE(created_at) as date, COUNT(*) as transactions,"
            "SUM((payload->>'amount')::numeric) as revenue "
            "FROM analytics_events WHERE event_type = 'payment.completed' "
            "GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30"
        )
    return [dict(r) for r in rows]
