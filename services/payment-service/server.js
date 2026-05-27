require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const amqp = require('amqplib');

const app  = express();
const port = process.env.PORT || 8000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.use(express.json());

let channel;
async function connectMQ() {
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:smartparking_pass@rabbitmq:5672');
    channel = await conn.createChannel();
    await channel.assertExchange('parking_events', 'topic', { durable: true });
  } catch (err) { setTimeout(connectMQ, 5000); }
}

pool.query(`CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    method VARCHAR(50) DEFAULT 'card',
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
  )`).catch(console.error);

connectMQ();

function calculateFee(entryTime, exitTime) {
  const durationMin = (new Date(exitTime) - new Date(entryTime)) / 60000;
  if (durationMin <= 60) return 20;
  return 20 + Math.ceil((durationMin - 60) / 30) * 10;
}

app.get('/health', (req, res) => res.json({ status: 'UP', service: 'payment-service' }));

app.post('/payments', async (req, res) => {
  const { booking_id, entry_time, exit_time, method = 'card' } = req.body;
  if (!booking_id || !entry_time || !exit_time) return res.status(400).json({ error: 'booking_id, entry_time, exit_time required' });
  try {
    const amount = calculateFee(entry_time, exit_time);
    const txId = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2,9).toUpperCase();
    const result = await pool.query(
      "INSERT INTO payments (booking_id, amount, status, method, transaction_id) VALUES ($1,$2,'completed',$3,$4) RETURNING *",
      [booking_id, amount, method, txId]
    );
    const payment = result.rows[0];
    if (channel) channel.publish('parking_events', 'payment.completed', Buffer.from(JSON.stringify(payment)));
    res.status(201).json({ message: 'Payment successful', payment });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/payments/booking/:booking_id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM payments WHERE booking_id=$1', [req.params.booking_id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () => console.log(`payment-service running on port ${port}`));
