'use strict';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../src/services/userService', () => ({
  getOrCreateUser: jest.fn(),
}));

const pool = require('../src/config/db');
const userService = require('../src/services/userService');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/expressApp');

function makeToken(sub) {
  return 'Bearer ' + jwt.sign({ sub, role: 'student' }, 'test-secret');
}

const STUDENT_TOKEN = makeToken('student-clerk-1');

beforeAll(() => {
  process.env.PAYFAST_MERCHANT_ID  = '10000100';
  process.env.PAYFAST_MERCHANT_KEY = '46f0cd694581a';
  process.env.PAYFAST_PASSPHRASE   = 'testpassphrase';
  process.env.BACKEND_URL          = 'http://localhost:3000';
  process.env.FRONTEND_URL         = 'http://localhost:5173';
});

beforeEach(() => {
  jest.clearAllMocks();
  userService.getOrCreateUser.mockResolvedValue({ id: 'db-user-1', role: 'student' });
});

// ─── GET /api/transactions ────────────────────────────────────────────────────

describe('GET /api/transactions', () => {
  test('400 when listing_id query param is missing', async () => {
    // GET route is defined before auth middleware in transactions.js, so no token required
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('listing_id is required');
  });

  test('500 when listing_id present but req.user is undefined (auth not applied to GET)', async () => {
    // The GET route is registered before router.use(auth), so req.user is never set.
    // Accessing req.user.id throws TypeError which the catch block returns as 500.
    const res = await request(app)
      .get('/api/transactions')
      .query({ listing_id: 'listing-1' });
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/transactions ───────────────────────────────────────────────────

describe('POST /api/transactions', () => {
  test('401 when no Authorization header', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send({ listingId: 'l1', type: 'purchase' });
    expect(res.status).toBe(401);
  });

  test('400 when listingId is missing', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', STUDENT_TOKEN)
      .send({ type: 'purchase' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('listingId and type are required');
  });

  test('400 when type is missing', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', STUDENT_TOKEN)
      .send({ listingId: 'l1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('listingId and type are required');
  });

  test('201 creates transaction and returns it', async () => {
    const txn = { id: 'txn-1', listing_id: 'l1', buyer_id: 'db-user-1', type: 'purchase', status: 'active' };
    pool.query.mockResolvedValue({ rows: [txn] });
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', STUDENT_TOKEN)
      .send({ listingId: 'l1', type: 'purchase' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'txn-1');
    expect(res.body.type).toBe('purchase');
  });

  test('500 when pool.query throws', async () => {
    pool.query.mockRejectedValue(new Error('DB unavailable'));
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', STUDENT_TOKEN)
      .send({ listingId: 'l1', type: 'purchase' });
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  test('500 when userService.getOrCreateUser throws', async () => {
    userService.getOrCreateUser.mockRejectedValue(new Error('Clerk down'));
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', STUDENT_TOKEN)
      .send({ listingId: 'l1', type: 'purchase' });
    expect(res.status).toBe(500);
  });
});
