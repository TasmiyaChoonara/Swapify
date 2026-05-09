jest.mock('../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../src/services/notificationService', () => ({ createNotification: jest.fn() }));
jest.mock('../src/services/userService', () => ({
  getOrCreateUser: jest.fn().mockResolvedValue({ id: 'db-user-1', role: 'staff' }),
}));

const pool = require('../src/config/db');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/expressApp');

function makeToken(sub, role = 'student') {
  return 'Bearer ' + jwt.sign({ sub, role }, 'test-secret');
}

const STAFF_TOKEN   = makeToken('staff-clerk-1', 'staff');
const STUDENT_TOKEN = makeToken('student-clerk-1', 'student');
const TRADE_ID      = 'trade-uuid-001';

beforeEach(() => jest.clearAllMocks());

// ── POST /api/bookings ────────────────────────────────────────────────────────
describe('POST /api/bookings', () => {
  test('400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', STUDENT_TOKEN)
      .send({});
    expect(res.status).toBe(400);
  });

  test('400 when slot is outside operating hours (before 8am)', async () => {
    const earlySlot = new Date();
    earlySlot.setHours(6, 0, 0, 0);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', STUDENT_TOKEN)
      .send({ trade_id: TRADE_ID, slot_time: earlySlot.toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/operating hours/i);
  });

  test('400 when slot is outside operating hours (after 6pm)', async () => {
    const lateSlot = new Date();
    lateSlot.setHours(19, 0, 0, 0);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', STUDENT_TOKEN)
      .send({ trade_id: TRADE_ID, slot_time: lateSlot.toISOString() });
    expect(res.status).toBe(400);
  });

  test('400 when slot is already booked', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // existing booking found

    const validSlot = new Date();
    validSlot.setHours(10, 0, 0, 0);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', STUDENT_TOKEN)
      .send({ trade_id: TRADE_ID, slot_time: validSlot.toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already booked/i);
  });

  test('201 on valid booking', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })            // no duplicate
      .mockResolvedValueOnce({ rows: [{ auth_id: 'seller-clerk-1' }] }) // seller lookup
      .mockResolvedValueOnce({ rows: [{ id: 99, trade_id: TRADE_ID, status: 'booked' }] }); // insert

    const validSlot = new Date();
    validSlot.setHours(10, 0, 0, 0);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', STUDENT_TOKEN)
      .send({ trade_id: TRADE_ID, slot_time: validSlot.toISOString() });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});

// ── GET /api/slots ────────────────────────────────────────────────────────────
describe('GET /api/slots', () => {
  test('200 with available slots for a date', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // no bookings yet
    const res = await request(app)
      .get('/api/slots')
      .set('Authorization', STUDENT_TOKEN)
      .query({ date: new Date().toISOString().split('T')[0] });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── PATCH /api/bookings/:id/receive ──────────────────────────────────────────
describe('PATCH /api/bookings/:id/receive', () => {
  test('403 without staff role', async () => {
    const res = await request(app)
      .patch('/api/bookings/1/receive')
      .set('Authorization', STUDENT_TOKEN);
    expect(res.status).toBe(403);
  });

  test('200 on success for staff', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, buyer_id: 'buyer-1', seller_id: 'seller-1' }] }) // booking exists
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'item_held', buyer_id: 'buyer-1', seller_id: 'seller-1' }] }); // update

    const res = await request(app)
      .patch('/api/bookings/1/receive')
      .set('Authorization', STAFF_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('item_held');
  });

  test('404 when booking not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .patch('/api/bookings/999/receive')
      .set('Authorization', STAFF_TOKEN);
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/bookings/:id/confirm-cash ─────────────────────────────────────
describe('PATCH /api/bookings/:id/confirm-cash', () => {
  test('403 without staff role', async () => {
    const res = await request(app)
      .patch('/api/bookings/1/confirm-cash')
      .set('Authorization', STUDENT_TOKEN);
    expect(res.status).toBe(403);
  });

  test('200 on success for staff', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, transaction_id: 'txn-1' }] }) // booking
      .mockResolvedValueOnce({ rows: [{ id: 'pay-1', cash_confirmed: true }] }); // payment update

    const res = await request(app)
      .patch('/api/bookings/1/confirm-cash')
      .set('Authorization', STAFF_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.cash_confirmed).toBe(true);
  });
});

// ── PATCH /api/bookings/:id/release ──────────────────────────────────────────
describe('PATCH /api/bookings/:id/release', () => {
  test('403 without staff role', async () => {
    const res = await request(app)
      .patch('/api/bookings/1/release')
      .set('Authorization', STUDENT_TOKEN);
    expect(res.status).toBe(403);
  });

  test('400 when cash shortfall not confirmed', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, status: 'item_held', cash_shortfall: 50, cash_confirmed: false, transaction_id: 'txn-1', buyer_id: 'b', seller_id: 's' }],
    });
    const res = await request(app)
      .patch('/api/bookings/1/release')
      .set('Authorization', STAFF_TOKEN);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cash shortfall/i);
  });

  test('200 on success when no shortfall', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'item_held', cash_shortfall: 0, cash_confirmed: false, transaction_id: 'txn-1', buyer_id: 'b', seller_id: 's' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'complete' }] }) // update bookings
      .mockResolvedValueOnce({ rows: [] }); // update transactions

    const res = await request(app)
      .patch('/api/bookings/1/release')
      .set('Authorization', STAFF_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('complete');
  });
});
