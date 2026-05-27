
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

describe('Booking Service', () => {
  let app;
  beforeAll(() => {
    mockPool.query.mockResolvedValue({ rows: [] });
    app = require('./server');
  });
  afterEach(() => jest.clearAllMocks());

  describe('GET /health', () => {
    it('returns 200 UP', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });
  });

  describe('POST /bookings', () => {
    it('creates booking successfully', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 1, slot_number: 5, vehicle_number: 'MH12AB1234', status: 'active' }]
      });
      const res = await request(app).post('/bookings').send({
        user_id: 1, slot_number: 5, vehicle_number: 'MH12AB1234'
      });
      expect(res.status).toBe(201);
      expect(res.body.booking.slot_number).toBe(5);
    });

    it('returns 400 if required fields missing', async () => {
      const res = await request(app).post('/bookings').send({ user_id: 1 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /bookings/:id', () => {
    it('returns booking by id', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 1, slot_number: 5, status: 'active' }]
      });
      const res = await request(app).get('/bookings/1');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
    });

    it('returns 404 for unknown booking', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/bookings/999');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /bookings/:id/cancel', () => {
    it('cancels booking', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).patch('/bookings/1/cancel');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/cancel/i);
    });
  });
});
