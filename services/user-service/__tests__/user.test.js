const request = require('supertest');

jest.mock('pg', () => {
  const mockQuery = jest.fn();
  return { Pool: jest.fn(() => ({ query: mockQuery })) };
});

const { Pool } = require('pg');
const mockPool = new Pool();

describe('User Service', () => {
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

  describe('POST /users', () => {
    it('creates a user profile', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, auth_user_id: 42, full_name: 'John Doe', phone: '+919999999999', vehicle_numbers: [] }]
      });
      const res = await request(app).post('/users').send({
        auth_user_id: 42,
        full_name: 'John Doe',
        phone: '+919999999999'
      });
      expect(res.status).toBe(201);
      expect(res.body.user.full_name).toBe('John Doe');
    });

    it('returns 400 if auth_user_id missing', async () => {
      const res = await request(app).post('/users').send({ full_name: 'Test' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /users/:auth_user_id', () => {
    it('returns user profile', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, auth_user_id: 42, full_name: 'John Doe' }]
      });
      const res = await request(app).get('/users/42');
      expect(res.status).toBe(200);
      expect(res.body.auth_user_id).toBe(42);
    });

    it('returns 404 if not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/users/999');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /users/:auth_user_id', () => {
    it('updates user profile', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, auth_user_id: 42, full_name: 'Jane Doe' }]
      });
      const res = await request(app).put('/users/42').send({ full_name: 'Jane Doe' });
      expect(res.status).toBe(200);
      expect(res.body.user.full_name).toBe('Jane Doe');
    });
  });

  describe('PATCH /users/:auth_user_id/vehicles', () => {
    it('adds vehicle to user', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ vehicle_numbers: ['MH12AB1234'] }]
      });
      const res = await request(app)
        .patch('/users/42/vehicles')
        .send({ vehicle_number: 'MH12AB1234' });
      expect(res.status).toBe(200);
      expect(res.body.vehicles).toContain('MH12AB1234');
    });
  });
});
