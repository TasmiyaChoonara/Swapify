'use strict';

// Mock the DB pool
jest.mock('../src/config/db', () => {
  const pool = {
    query: jest.fn(),
    end: jest.fn(),
  };
  return pool;
});

// Mock auth middleware — sets req.clerkUser and req.authId
jest.mock('../src/middleware/auth', () => (req, res, next) => {
  req.clerkUser = { id: req.headers['x-mock-clerk-id'] ?? 'user_test123' };
  req.authId = req.headers['x-mock-clerk-id'] ?? 'user_test123';
  next();
});

// Mock userService
jest.mock('../src/services/userService', () => ({
  getOrCreateUser: jest.fn().mockResolvedValue({
    id: 'db-user-uuid',
    auth_id: 'user_test123',
    role: 'student',
  }),
}));

// Mock analyticsModel
jest.mock('../src/models/analyticsModel', () => ({
  getAnalytics: jest.fn(),
  getAnalyticsCSV: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const adminRoutes = require('../src/routes/adminRoutes');
const { getAnalytics, getAnalyticsCSV } = require('../src/models/analyticsModel');
const userService = require('../src/services/userService');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  return app;
}

const MOCK_ANALYTICS = {
  categories: [{ category: 'electronics', count: '5' }],
  transactions: [{ date: '2026-04-01', count: '3' }],
  flagged: { count: '1' },
  listingStats: [{ status: 'active', count: '10' }],
  userCount: { count: '2' },
  paymentStats: [{ status: 'paid', count: '1', total: '350.00' }],
  facilityUtilisation: [{ date: '2026-04-18', booked: '3', capacity: '10', utilisation_pct: '30.0' }],
  moderationReport: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/admin/analytics', () => {
  test('returns 403 for non-admin user', async () => {
    userService.getOrCreateUser.mockResolvedValueOnce({
      id: 'db-user-uuid',
      auth_id: 'user_test123',
      role: 'student',
    });

    const app = makeApp();
    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', 'Bearer fake-token')
      .set('x-mock-clerk-id', 'user_test123');

    expect(res.status).toBe(403);
  });

  test('returns 200 with correct shape for admin user', async () => {
    userService.getOrCreateUser.mockResolvedValueOnce({
      id: 'db-user-uuid',
      auth_id: 'user_admin123',
      role: 'admin',
    });
    getAnalytics.mockResolvedValueOnce(MOCK_ANALYTICS);

    const app = makeApp();
    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', 'Bearer fake-token')
      .set('x-mock-clerk-id', 'user_admin123');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('categories');
    expect(res.body).toHaveProperty('transactions');
    expect(res.body).toHaveProperty('facilityUtilisation');
    expect(res.body).toHaveProperty('moderationReport');
    expect(res.body).toHaveProperty('userCount');
    expect(res.body).toHaveProperty('paymentStats');
  });
});

describe('GET /api/admin/analytics/export', () => {
  test('returns 403 for non-admin user', async () => {
    userService.getOrCreateUser.mockResolvedValueOnce({
      id: 'db-user-uuid',
      auth_id: 'user_test123',
      role: 'student',
    });

    const app = makeApp();
    const res = await request(app)
      .get('/api/admin/analytics/export')
      .set('Authorization', 'Bearer fake-token')
      .set('x-mock-clerk-id', 'user_test123');

    expect(res.status).toBe(403);
  });

  test('returns 200 with text/csv content type for admin', async () => {
    userService.getOrCreateUser.mockResolvedValueOnce({
      id: 'db-user-uuid',
      auth_id: 'user_admin123',
      role: 'admin',
    });
    getAnalyticsCSV.mockResolvedValueOnce('Date,Count\n2026-04-01,3\n');

    const app = makeApp();
    const res = await request(app)
      .get('/api/admin/analytics/export')
      .set('Authorization', 'Bearer fake-token')
      .set('x-mock-clerk-id', 'user_admin123');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });
});