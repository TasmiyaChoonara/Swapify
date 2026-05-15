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

const AUTH      = 'Bearer mock-token';
const TODAY     = new Date().toISOString().split('T')[0];
const PAST_DATE = '2020-01-01';

beforeEach(() => jest.clearAllMocks());

describe('GET /api/slots', () => {
  test('401 without auth header', async () => {
    const res = await request(app).get('/api/slots').query({ date: TODAY });
    expect(res.status).toBe(401);
  });

  test('400 when date query param is missing', async () => {
    const res = await request(app)
      .get('/api/slots')
      .set('Authorization', AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/date is required/i);
  });

  test('200 returns 10 hourly slots when none are booked', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/slots')
      .set('Authorization', AUTH)
      .query({ date: TODAY });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(10);
    expect(res.body.every(s => s.available === true)).toBe(true);
  });

  test('marks a slot as unavailable when already booked', async () => {
    const bookedTime = new Date(`${TODAY}T10:00:00`).toISOString();
    pool.query.mockResolvedValueOnce({ rows: [{ slot_time: bookedTime }] });
    const res = await request(app)
      .get('/api/slots')
      .set('Authorization', AUTH)
      .query({ date: TODAY });
    expect(res.status).toBe(200);
    const slot10 = res.body.find(s => new Date(s.time).getHours() === 10);
    expect(slot10.available).toBe(false);
  });

  test('all other slots remain available when one is booked', async () => {
    const bookedTime = new Date(`${TODAY}T09:00:00`).toISOString();
    pool.query.mockResolvedValueOnce({ rows: [{ slot_time: bookedTime }] });
    const res = await request(app)
      .get('/api/slots')
      .set('Authorization', AUTH)
      .query({ date: TODAY });
    const unavailable = res.body.filter(s => !s.available);
    expect(unavailable).toHaveLength(1);
    expect(new Date(unavailable[0].time).getHours()).toBe(9);
  });

  test('all slots unavailable when all are booked', async () => {
    const bookedRows = [];
    for (let h = 8; h < 18; h++) {
      bookedRows.push({ slot_time: new Date(`${TODAY}T${String(h).padStart(2,'0')}:00:00`).toISOString() });
    }
    pool.query.mockResolvedValueOnce({ rows: bookedRows });
    const res = await request(app)
      .get('/api/slots')
      .set('Authorization', AUTH)
      .query({ date: TODAY });
    expect(res.status).toBe(200);
    expect(res.body.every(s => s.available === false)).toBe(true);
  });

  test('works for a past date without error', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/slots')
      .set('Authorization', AUTH)
      .query({ date: PAST_DATE });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
  });
});
