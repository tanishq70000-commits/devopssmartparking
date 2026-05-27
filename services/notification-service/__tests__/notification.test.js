
const request = require('supertest');

jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertExchange: jest.fn(),
      assertQueue: jest.fn().mockResolvedValue({ queue: 'notification_queue' }),
      bindQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
    })
  })
}));

describe('Notification Service', () => {
  let app;
  beforeAll(() => { app = require('./server'); });

  describe('GET /health', () => {
    it('returns UP', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });
  });

  describe('GET /notifications', () => {
    it('returns notifications list', async () => {
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('notifications');
      expect(Array.isArray(res.body.notifications)).toBe(true);
    });
  });
});
