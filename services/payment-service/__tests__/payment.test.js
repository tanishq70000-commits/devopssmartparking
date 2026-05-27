
const request = require('supertest');

jest.mock('pg', () => {
  const mockQuery = jest.fn();
  return { Pool: jest.fn(() => ({ query: mockQuery })) };
});
jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertExchange: jest.fn(),
      publish: jest.fn(),
    })
  })
}));

const { Pool } = require('pg');
const mockPool = new Pool();

describe('Payment Service', () => {
  let app;
  beforeAll(() => {
    mockPool.query.mockResolvedValue({ rows: [] });
    app = require('./server');
  });
  afterEach(() => jest.clearAllMocks());

  describe('GET /health', () => {
    it('returns UP', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });
  });

  describe('POST /payments', () => {
    it('creates payment for booking within 1 hour (fee = 20)', async () => {
      const entry = new Date();
      const exit  = new Date(entry.getTime() + 45 * 60000); // 45 min later
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, booking_id: 1, amount: 20, status: 'completed', transaction_id: 'TXN-123' }]
      });
      const res = await request(app).post('/payments').send({
        booking_id: 1,
        entry_time: entry.toISOString(),
        exit_time: exit.toISOString()
      });
      expect(res.status).toBe(201);
      expect(res.body.payment.amount).toBe(20);
    });

    it('returns 400 if fields missing', async () => {
      const res = await request(app).post('/payments').send({ booking_id: 1 });
      expect(res.status).toBe(400);
    });
  });

  describe('Fee Calculation', () => {
    it('charges 30 for 90 min stay', async () => {
      const entry = new Date();
      const exit  = new Date(entry.getTime() + 90 * 60000);
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, booking_id: 2, amount: 30, status: 'completed', transaction_id: 'TXN-456' }]
      });
      const res = await request(app).post('/payments').send({
        booking_id: 2,
        entry_time: entry.toISOString(),
        exit_time: exit.toISOString()
      });
      expect(res.status).toBe(201);
    });
  });
});
