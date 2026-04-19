jest.mock('../src/models/facilityConfig');
const facilityConfigModel = require('../src/models/facilityConfig');
const { updateDayConfig, validate } = require('../src/services/facilityConfigService');

const ADMIN_ID = 'admin-uuid-001';

describe('validate()', () => {
  test('returns error for invalid dayOfWeek', () => {
    const result = validate({ dayOfWeek: 7, openTime: '08:00', closeTime: '17:00', slotCapacity: 5 });
    expect(result.error).toBeDefined();
  });
  test('returns error when openTime >= closeTime', () => {
    const result = validate({ dayOfWeek: 1, openTime: '17:00', closeTime: '08:00', slotCapacity: 5 });
    expect(result.error).toBeDefined();
  });
  test('returns error for non-positive slotCapacity', () => {
    const result = validate({ dayOfWeek: 1, openTime: '08:00', closeTime: '17:00', slotCapacity: 0 });
    expect(result.error).toBeDefined();
  });
  test('returns sanitised values on valid input', () => {
    const result = validate({ dayOfWeek: '1', openTime: '08:00', closeTime: '17:00', slotCapacity: '10' });
    expect(result.error).toBeUndefined();
    expect(result.dayOfWeek).toBe(1);
    expect(result.slotCapacity).toBe(10);
  });
});

describe('updateDayConfig()', () => {
  beforeEach(() => jest.clearAllMocks());
  test('throws 400 for invalid input', async () => {
    await expect(
      updateDayConfig({ dayOfWeek: 9, openTime: '08:00', closeTime: '17:00', slotCapacity: 5, updatedBy: ADMIN_ID })
    ).rejects.toMatchObject({ status: 400 });
  });
  test('calls model upsert with correct args', async () => {
    const mockRow = { id: 'cfg-1', day_of_week: 1 };
    facilityConfigModel.upsertByDay.mockResolvedValue(mockRow);
    const result = await updateDayConfig({ dayOfWeek: 1, openTime: '08:00', closeTime: '17:00', slotCapacity: 10, updatedBy: ADMIN_ID });
    expect(facilityConfigModel.upsertByDay).toHaveBeenCalledWith({ dayOfWeek: 1, openTime: '08:00', closeTime: '17:00', slotCapacity: 10, updatedBy: ADMIN_ID });
    expect(result).toEqual(mockRow);
  });
  test('non-admin gets 403', () => {
    const requireRole = require('../src/middleware/roles');
    const middleware = requireRole('admin');
    const req = { user: { role: 'student' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  test('admin is allowed through', () => {
    const requireRole = require('../src/middleware/roles');
    const middleware = requireRole('admin');
    const req = { user: { role: 'admin' } };
    const res = {};
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
