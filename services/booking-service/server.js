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
    console.log('booking-service connected to RabbitMQ');
  } catch (err) {
    console.error('MQ error, retry in 5s:', err.message);
    setTimeout(connectMQ, 5000);
  }
}

pool.query(`CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    slot_number INT NOT NULL,
    vehicle_number VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    entry_time TIMESTAMP DEFAULT NOW(),
    exit_time TIMESTAMP,
    fee NUMERIC(10,2)
  )`).catch(console.error);

connectMQ();

app.get('/health', (req, res) => res.json({ status: 'UP', service: 'booking-service' }));

app.post('/bookings', async (req, res) => {
  const { user_id, slot_number, vehicle_number } = req.body;
  if (!user_id || !slot_number) return res.status(400).json({ error: 'user_id and slot_number required' });
  try {
    const result = await pool.query(
      "INSERT INTO bookings (user_id, slot_number, vehicle_number) VALUES ($1,$2,$3) RETURNING *",
      [user_id, slot_number, vehicle_number]
    );
    const booking = result.rows[0];
    if (channel) channel.publish('parking_events', 'booking.created', Buffer.from(JSON.stringify(booking)));
    res.status(201).json({ message: 'Booking created', booking });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/bookings/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Booking not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/bookings/:id/cancel', async (req, res) => {
  try {
    await pool.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [req.params.id]);
    if (channel) channel.publish('parking_events', 'booking.cancelled', Buffer.from(JSON.stringify({ id: req.params.id })));
    res.json({ message: 'Booking cancelled' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () => console.log(`booking-service running on port ${port}`));
