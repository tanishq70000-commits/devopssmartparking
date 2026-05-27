require('dotenv').config();
const express = require('express');
const amqp = require('amqplib');

const app  = express();
const port = process.env.PORT || 8000;
app.use(express.json());

const notifications = [];

async function startConsumer() {
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:smartparking_pass@rabbitmq:5672');
    const ch = await conn.createChannel();
    await ch.assertExchange('parking_events', 'topic', { durable: true });
    const q = await ch.assertQueue('notification_queue', { durable: true });
    await ch.bindQueue(q.queue, 'parking_events', 'booking.created');
    await ch.bindQueue(q.queue, 'parking_events', 'booking.cancelled');
    await ch.bindQueue(q.queue, 'parking_events', 'payment.completed');
    ch.consume(q.queue, (msg) => {
      if (!msg) return;
      const entry = { id: Date.now(), type: msg.fields.routingKey, data: JSON.parse(msg.content.toString()), ts: new Date().toISOString() };
      notifications.push(entry);
      console.log('[NOTIF]', entry.type, entry.data);
      ch.ack(msg);
    });
    console.log('Notification consumer started');
  } catch (err) {
    console.error('MQ error, retry:', err.message);
    setTimeout(startConsumer, 5000);
  }
}

startConsumer();
app.get('/health', (req, res) => res.json({ status: 'UP', service: 'notification-service' }));
app.get('/notifications', (req, res) => res.json({ total: notifications.length, notifications: notifications.slice(-50) }));
app.listen(port, () => console.log(`notification-service running on port ${port}`));
