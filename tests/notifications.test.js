'use strict';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../src/services/userService', () => ({
  getOrCreateUser: jest.fn().mockResolvedValue({ id: 'db-user-1', role: 'student' }),
}));

const pool = require('../src/config/db');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/expressApp');

function makeToken(sub) {
  return 'Bearer ' + jwt.sign({ sub }, 'test-secret');
}

const TOKEN = makeToken('user-clerk-1');

beforeAll(() => {
  process.env.PAYFAST_MERCHANT_ID  = '10000100';
  process.env.PAYFAST_MERCHANT_KEY = '46f0cd694581a';
  process.env.PAYFAST_PASSPHRASE   = 'testpassphrase';
  process.env.BACKEND_URL          = 'http://localhost:3000';
  process.env.FRONTEND_URL         = 'http://localhost:5173';
});

beforeEach(() => jest.clearAllMocks());

// ─── GET /api/notifications ───────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  test('401 when no Authorization header', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  test('200 with empty array when no notifications', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('200 with notifications array', async () => {
    const rows = [
      { id: 'n1', user_clerk_id: 'user-clerk-1', message: 'Item received', read: false },
      { id: 'n2', user_clerk_id: 'user-clerk-1', message: 'Trade complete', read: false },
    ];
    pool.query.mockResolvedValue({ rows });
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].message).toBe('Item received');
  });

  test('500 when pool.query throws', async () => {
    pool.query.mockRejectedValue(new Error('DB down'));
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', TOKEN);
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Server error');
  });
});

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────

describe('PATCH /api/notifications/:id/read', () => {
  test('401 when no Authorization header', async () => {
    const res = await request(app).patch('/api/notifications/n1/read');
    expect(res.status).toBe(401);
  });

  test('200 with updated notification when found', async () => {
    const row = { id: 'n1', read: true, message: 'Item received' };
    pool.query.mockResolvedValue({ rows: [row] });
    const res = await request(app)
      .patch('/api/notifications/n1/read')
      .set('Authorization', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.read).toBe(true);
  });

  test('404 when notification not found or belongs to another user', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .patch('/api/notifications/nonexistent/read')
      .set('Authorization', TOKEN);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not found');
  });

  test('500 when pool.query throws', async () => {
    pool.query.mockRejectedValue(new Error('DB down'));
    const res = await request(app)
      .patch('/api/notifications/n1/read')
      .set('Authorization', TOKEN);
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Server error');
  });
});

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────

describe('PATCH /api/notifications/read-all', () => {
  test('401 when no Authorization header', async () => {
    const res = await request(app).patch('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });

  test('200 with success flag when all notifications marked read', async () => {
    pool.query.mockResolvedValue({ rows: [], rowCount: 3 });
    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  test('200 with success true even when user has no notifications', async () => {
    pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('500 when pool.query throws', async () => {
    pool.query.mockRejectedValue(new Error('DB down'));
    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', TOKEN);
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Server error');
  });
});
