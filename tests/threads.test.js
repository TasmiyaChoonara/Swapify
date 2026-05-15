'use strict';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../src/services/userService', () => ({
  getOrCreateUser: jest.fn().mockResolvedValue({ id: 'db-buyer-1', role: 'student' }),
}));
jest.mock('jsonwebtoken', () => ({
  decode: jest.fn().mockReturnValue({ sub: 'clerk-buyer-1', email: 'buyer@test.com' }),
  sign: jest.fn().mockReturnValue('mock-token'),
}));

const pool        = require('../src/config/db');
const request     = require('supertest');
const app         = require('../src/expressApp');
const threadModel = require('../src/models/threadModel');

const AUTH       = 'Bearer mock-token';
const LISTING_ID = 'listing-uuid-001';
const BUYER_ID   = 'db-buyer-1';
const SELLER_ID  = 'db-seller-1';

beforeEach(() => jest.clearAllMocks());

describe('threadModel.getOrCreateThread', () => {
  test('returns existing thread when one exists', async () => {
    const existing = { id: 'thread-1', listing_id: LISTING_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID };
    pool.query.mockResolvedValueOnce({ rows: [existing] });
    const result = await threadModel.getOrCreateThread(LISTING_ID, BUYER_ID, SELLER_ID);
    expect(result).toEqual(existing);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('creates and returns new thread when none exists', async () => {
    const created = { id: 'thread-2', listing_id: LISTING_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID };
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [created] });
    const result = await threadModel.getOrCreateThread(LISTING_ID, BUYER_ID, SELLER_ID);
    expect(result).toEqual(created);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('passes correct params to SELECT query', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 't-1' }] });
    await threadModel.getOrCreateThread('l-1', 'b-1', 's-1');
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['l-1', 'b-1', 's-1']);
  });
});

describe('GET /api/threads/listing/:listingId', () => {
  test('401 without auth header', async () => {
    const res = await request(app).get(`/api/threads/listing/${LISTING_ID}`);
    expect(res.status).toBe(401);
  });

  test('200 returns threads for listing', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'thread-1', listing_id: LISTING_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID }],
    });
    const res = await request(app)
      .get(`/api/threads/listing/${LISTING_ID}`)
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('200 returns empty array when no threads exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get(`/api/threads/listing/${LISTING_ID}`)
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/threads', () => {
  test('401 without auth header', async () => {
    const res = await request(app)
      .post('/api/threads')
      .send({ listingId: LISTING_ID, buyerId: BUYER_ID, sellerId: SELLER_ID });
    expect(res.status).toBe(401);
  });

  test('200 returns existing thread when one exists', async () => {
    const thread = { id: 'thread-1', listing_id: LISTING_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID };
    pool.query.mockResolvedValueOnce({ rows: [thread] });
    const res = await request(app)
      .post('/api/threads')
      .set('Authorization', AUTH)
      .send({ listingId: LISTING_ID, buyerId: BUYER_ID, sellerId: SELLER_ID });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'thread-1');
  });

  test('200 creates and returns new thread', async () => {
    const created = { id: 'thread-new', listing_id: LISTING_ID, buyer_id: BUYER_ID, seller_id: SELLER_ID };
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [created] });
    const res = await request(app)
      .post('/api/threads')
      .set('Authorization', AUTH)
      .send({ listingId: LISTING_ID, buyerId: BUYER_ID, sellerId: SELLER_ID });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'thread-new');
  });
});
