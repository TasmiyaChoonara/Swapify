'use strict';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../src/services/userService', () => ({
  getOrCreateUser: jest.fn().mockResolvedValue({ id: 'db-user-1', role: 'student' }),
}));
jest.mock('jsonwebtoken', () => ({
  decode: jest.fn().mockReturnValue({ sub: 'clerk-user-1', email: 'test@test.com' }),
  sign: jest.fn().mockReturnValue('mock-token'),
}));

const pool    = require('../src/config/db');
const request = require('supertest');
const app     = require('../src/expressApp');

const AUTH       = 'Bearer mock-token';
const LISTING_ID = 'listing-uuid-001';

beforeEach(() => jest.clearAllMocks());

describe('GET /api/saved', () => {
  test('401 without auth', async () => {
    const res = await request(app).get('/api/saved');
    expect(res.status).toBe(401);
  });

  test('200 returns saved listings array', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'saved-1', listing_id: LISTING_ID, title: 'Textbook', price: 100 }],
    });
    const res = await request(app).get('/api/saved').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  test('200 returns empty array when nothing saved', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/saved').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/saved/:listingId', () => {
  test('401 without auth', async () => {
    const res = await request(app).post(`/api/saved/${LISTING_ID}`);
    expect(res.status).toBe(401);
  });

  test('201 saves listing successfully', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'saved-1', user_id: 'db-user-1', listing_id: LISTING_ID }],
    });
    const res = await request(app)
      .post(`/api/saved/${LISTING_ID}`)
      .set('Authorization', AUTH);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'saved-1');
  });

  test('409 when listing already saved', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post(`/api/saved/${LISTING_ID}`)
      .set('Authorization', AUTH);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already saved/i);
  });
});

describe('DELETE /api/saved/:listingId', () => {
  test('401 without auth', async () => {
    const res = await request(app).delete(`/api/saved/${LISTING_ID}`);
    expect(res.status).toBe(401);
  });

  test('204 removes saved listing', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app)
      .delete(`/api/saved/${LISTING_ID}`)
      .set('Authorization', AUTH);
    expect(res.status).toBe(204);
  });

  test('404 when saved listing not found', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    const res = await request(app)
      .delete(`/api/saved/${LISTING_ID}`)
      .set('Authorization', AUTH);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('GET /api/transactions/mine/sold', () => {
  test('401 without auth', async () => {
    const res = await request(app).get('/api/transactions/mine/sold');
    expect(res.status).toBe(401);
  });

  test('200 returns completed sales', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 't-1', listing_title: 'Laptop', price: 500, buyer_name: 'Bob', status: 'complete' }],
    });
    const res = await request(app)
      .get('/api/transactions/mine/sold')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].listing_title).toBe('Laptop');
  });

  test('200 returns empty array when no completed sales', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/transactions/mine/sold')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/listings/mine/expired', () => {
  test('401 without auth', async () => {
    const res = await request(app).get('/api/listings/mine/expired');
    expect(res.status).toBe(401);
  });

  test('200 returns expired listings', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: LISTING_ID, title: 'Old Laptop', expires_at: '2020-01-01' }],
    });
    const res = await request(app)
      .get('/api/listings/mine/expired')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('200 returns empty array when no expired listings', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/listings/mine/expired')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
