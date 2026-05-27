const request = require('supertest');

// Mock pg Pool so no real DB needed
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  return { Pool: jest.fn(() => ({ query: mockQuery })) };
});

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn().mockReturnValue({ id: 1, email: 'test@test.com', role: 'user' }),
}));

const { Pool } = require('pg');
const mockPoolInstance = new Pool();

describe('Auth Service', () => {
  let app;

  beforeAll(() => {
    mockPoolInstance.query.mockResolvedValue({ rows: [] }); // suppress CREATE TABLE
    app = require('./server');
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /health', () => {
    it('returns 200 with service status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.service).toBe('auth-service');
    });
  });

  describe('POST /register', () => {
    it('registers a new user successfully', async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'test@test.com', role: 'user' }]
      });
      const res = await request(app)
        .post('/register')
        .send({ email: 'test@test.com', password: 'Password123!' });
      expect(res.status).toBe(201);
      expect(res.body.token).toBe('mock.jwt.token');
      expect(res.body.user.email).toBe('test@test.com');
    });

    it('returns 400 if email or password missing', async () => {
      const res = await request(app).post('/register').send({ email: 'test@test.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 409 if email already exists', async () => {
      mockPoolInstance.query.mockRejectedValueOnce({ code: '23505' });
      const res = await request(app)
        .post('/register')
        .send({ email: 'existing@test.com', password: 'Password123!' });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /login', () => {
    it('logs in with valid credentials', async () => {
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'test@test.com', role: 'user', password: 'hashed_password' }]
      });
      const res = await request(app)
        .post('/login')
        .send({ email: 'test@test.com', password: 'Password123!' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBe('mock.jwt.token');
    });

    it('returns 401 for unknown user', async () => {
      mockPoolInstance.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post('/login')
        .send({ email: 'nobody@test.com', password: 'pass' });
      expect(res.status).toBe(401);
    });

    it('returns 400 if fields missing', async () => {
      const res = await request(app).post('/login').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /verify', () => {
    it('verifies a valid token', async () => {
      const res = await request(app)
        .post('/verify')
        .set('Authorization', 'Bearer mock.jwt.token');
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    it('returns 401 if no token provided', async () => {
      const res = await request(app).post('/verify');
      expect(res.status).toBe(401);
    });
  });
});
