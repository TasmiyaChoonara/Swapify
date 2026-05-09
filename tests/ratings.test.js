jest.mock('../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../src/services/userService', () => ({
  getOrCreateUser: jest.fn().mockResolvedValue({ id: 'user-buyer-id', role: 'student' }),
}));
jest.mock('jsonwebtoken', () => ({
  decode: jest.fn().mockReturnValue({ sub: 'clerk-user-id', email: 'test@test.com' }),
}));

const pool = require('../src/config/db');
const request = require('supertest');
const app = require('../src/expressApp');

const TRANSACTION_ID = 'txn-uuid-001';
const REVIEWEE_ID = 'user-seller-id';
const REVIEWER_ID = 'user-buyer-id';
const RATING_ID = 'rat-uuid-001';

const COMPLETE_TX = { id: TRANSACTION_ID, status: 'complete', buyer_id: REVIEWER_ID, seller_id: REVIEWEE_ID };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/ratings', () => {
  test('400 when missing required fields', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', 'Bearer valid.token.here')
      .send({ transaction_id: TRANSACTION_ID });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  test('403 if user is not party to the transaction', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: TRANSACTION_ID, status: 'complete', buyer_id: 'other-user', seller_id: 'another-user' }]
    });
    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', 'Bearer valid.token.here')
      .send({ transaction_id: TRANSACTION_ID, reviewee_id: REVIEWEE_ID, score: 4 });
    expect(res.status).toBe(403);
  });

  test('400 if transaction is not complete', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: TRANSACTION_ID, status: 'active', buyer_id: REVIEWER_ID, seller_id: REVIEWEE_ID }]
    });
    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', 'Bearer valid.token.here')
      .send({ transaction_id: TRANSACTION_ID, reviewee_id: REVIEWEE_ID, score: 4 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not complete/);
  });

  test('400 if user has already rated this transaction', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [COMPLETE_TX] })
      .mockResolvedValueOnce({ rows: [{ id: RATING_ID }] });
    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', 'Bearer valid.token.here')
      .send({ transaction_id: TRANSACTION_ID, reviewee_id: REVIEWEE_ID, score: 4 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already rated/);
  });

  test('201 on valid data', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [COMPLETE_TX] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: RATING_ID, score: 4, comment: 'Great!' }] });
    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', 'Bearer valid.token.here')
      .send({ transaction_id: TRANSACTION_ID, reviewee_id: REVIEWEE_ID, score: 4, comment: 'Great!' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', RATING_ID);
  });
});

describe('GET /api/ratings/user/:userId', () => {
  test('200 with array and average', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: RATING_ID, score: 4, reviewer_name: 'Alice', reviewee_id: REVIEWEE_ID },
        { id: 'rat-uuid-002', score: 2, reviewer_name: 'Bob', reviewee_id: REVIEWEE_ID },
      ],
    });
    const res = await request(app).get(`/api/ratings/user/${REVIEWEE_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.ratings).toHaveLength(2);
    expect(res.body.average).toBe(3);
    expect(res.body.count).toBe(2);
  });

  test('200 with empty array when no ratings', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get(`/api/ratings/user/${REVIEWEE_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.ratings).toHaveLength(0);
    expect(res.body.average).toBeNull();
  });
});
