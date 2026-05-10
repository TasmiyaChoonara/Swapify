'use strict';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

const pool = require('../src/config/db');
const { getAnalytics, getAnalyticsCSV } = require('../src/models/analyticsModel');

beforeEach(() => jest.clearAllMocks());

// Queue all 8 pool.query responses that getAnalytics() makes in sequence
function mockAllQueries(overrides = {}) {
  pool.query
    .mockResolvedValueOnce({ rows: overrides.categories   ?? [{ category: 'electronics', count: '5' }] })
    .mockResolvedValueOnce({ rows: overrides.transactions  ?? [{ date: '2026-01-01', count: '3' }] })
    .mockResolvedValueOnce({ rows: overrides.flagged       ?? [{ count: '2' }] })
    .mockResolvedValueOnce({ rows: overrides.listingStats  ?? [{ status: 'active', count: '10' }] })
    .mockResolvedValueOnce({ rows: overrides.userCount     ?? [{ count: '15' }] })
    .mockResolvedValueOnce({ rows: overrides.paymentStats  ?? [{ status: 'paid', count: '1', total: '150.00' }] })
    .mockResolvedValueOnce({ rows: overrides.facilityUtil  ?? [{ date: '2026-01-01', booked: '3', capacity: '10', utilisation_pct: '30.0' }] })
    .mockResolvedValueOnce({ rows: overrides.moderation    ?? [{ week: '2026-01-01', flagged_count: '1', removed_count: '0' }] });
}

// ─── getAnalytics ─────────────────────────────────────────────────────────────

describe('getAnalytics', () => {
  test('calls pool.query 8 times and returns structured result', async () => {
    mockAllQueries();
    const result = await getAnalytics();
    expect(pool.query).toHaveBeenCalledTimes(8);
    expect(result).toHaveProperty('categories');
    expect(result).toHaveProperty('transactions');
    expect(result).toHaveProperty('flagged');
    expect(result).toHaveProperty('listingStats');
    expect(result).toHaveProperty('userCount');
    expect(result).toHaveProperty('paymentStats');
    expect(result).toHaveProperty('facilityUtilisation');
    expect(result).toHaveProperty('moderationReport');
  });

  test('categories result contains correct data', async () => {
    mockAllQueries();
    const result = await getAnalytics();
    expect(result.categories[0]).toEqual({ category: 'electronics', count: '5' });
  });

  test('transactions result contains correct data', async () => {
    mockAllQueries();
    const result = await getAnalytics();
    expect(result.transactions[0]).toEqual({ date: '2026-01-01', count: '3' });
  });

  test('paymentStats contains correct data', async () => {
    mockAllQueries();
    const result = await getAnalytics();
    expect(result.paymentStats[0]).toMatchObject({ status: 'paid', count: '1', total: '150.00' });
  });

  test('returns empty arrays when queries return no rows', async () => {
    mockAllQueries({
      categories: [], transactions: [], listingStats: [],
      paymentStats: [], facilityUtil: [], moderation: [],
      flagged: [{ count: '0' }], userCount: [{ count: '0' }],
    });
    const result = await getAnalytics();
    expect(result.categories).toEqual([]);
    expect(result.transactions).toEqual([]);
    expect(result.moderationReport).toEqual([]);
  });

  test('moderationReport defaults to empty when query throws', async () => {
    // First 7 queries succeed, 8th (moderation) throws
    pool.query
      .mockResolvedValueOnce({ rows: [{ category: 'textbooks', count: '2' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('column flagged does not exist'));
    const result = await getAnalytics();
    expect(result.moderationReport).toEqual([]);
  });

  test('facilityUtilisation contains expected shape', async () => {
    mockAllQueries();
    const result = await getAnalytics();
    expect(result.facilityUtilisation[0]).toMatchObject({
      date: '2026-01-01', booked: '3', capacity: '10',
    });
  });
});

// ─── getAnalyticsCSV ─────────────────────────────────────────────────────────

describe('getAnalyticsCSV', () => {
  test('returns a string', async () => {
    mockAllQueries();
    const csv = await getAnalyticsCSV();
    expect(typeof csv).toBe('string');
  });

  test('contains all section headers', async () => {
    mockAllQueries();
    const csv = await getAnalyticsCSV();
    expect(csv).toContain('=== CATEGORY POPULARITY ===');
    expect(csv).toContain('=== COMPLETED TRANSACTIONS (LAST 30 DAYS) ===');
    expect(csv).toContain('=== LISTING STATUS SUMMARY ===');
    expect(csv).toContain('=== PAYMENT SUMMARY ===');
    expect(csv).toContain('=== MODERATION SUMMARY ===');
    expect(csv).toContain('=== FACILITY UTILISATION (LAST 30 DAYS) ===');
    expect(csv).toContain('=== MODERATION TRENDS (LAST 30 DAYS) ===');
    expect(csv).toContain('=== PLATFORM TOTALS ===');
  });

  test('contains category data rows', async () => {
    mockAllQueries();
    const csv = await getAnalyticsCSV();
    expect(csv).toContain('electronics,5');
  });

  test('contains payment data rows with formatted total', async () => {
    mockAllQueries();
    const csv = await getAnalyticsCSV();
    expect(csv).toContain('paid,1,150.00');
  });

  test('contains facility utilisation data rows', async () => {
    mockAllQueries();
    const csv = await getAnalyticsCSV();
    expect(csv).toContain('2026-01-01,3,10,30.0');
  });

  test('contains moderation trend data rows', async () => {
    mockAllQueries();
    const csv = await getAnalyticsCSV();
    expect(csv).toContain('2026-01-01,1,0');
  });

  test('contains platform total user count', async () => {
    mockAllQueries();
    const csv = await getAnalyticsCSV();
    expect(csv).toContain('15');
  });

  test('handles empty data sets without crashing', async () => {
    mockAllQueries({
      categories: [], transactions: [], listingStats: [],
      paymentStats: [], facilityUtil: [], moderation: [],
      flagged: [{ count: '0' }], userCount: [{ count: '0' }],
    });
    const csv = await getAnalyticsCSV();
    expect(csv).toContain('=== CATEGORY POPULARITY ===');
    expect(csv).toContain('Category,Listing Count');
  });
});
