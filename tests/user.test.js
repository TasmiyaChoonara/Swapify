'use strict';

// Mock the user model so no real DB connection is needed
jest.mock('../src/models/user');
jest.mock('../src/config/db', () => ({ query: jest.fn() }));

const pool = require('../src/config/db');
const userModel = require('../src/models/user');
const realUserModel = jest.requireActual('../src/models/user');
const { getOrCreateUser, updateUserRole } = require('../src/services/userService');
const userService = require('../src/services/userService');
const userController = require('../src/controllers/userController');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getOrCreateUser', () => {
  test('returns existing user when auth_id already exists', async () => {
    const existingUser = { id: 1, auth_id: 'clerk_001', name: 'Bob', email: 'bob@uni.edu' };
    userModel.findByAuthId.mockResolvedValue(existingUser);

    const clerkUser = { id: 'clerk_001' };
    const result = await getOrCreateUser(clerkUser);

    expect(userModel.findByAuthId).toHaveBeenCalledWith('clerk_001');
    expect(userModel.create).not.toHaveBeenCalled();
    expect(result).toEqual(existingUser);
  });

  test('creates and returns a new user when auth_id is not found', async () => {
    const newUser = { id: 2, auth_id: 'clerk_002', name: 'Alice Smith', email: 'alice@uni.edu' };
    userModel.findByAuthId.mockResolvedValue(null);
    userModel.create.mockResolvedValue(newUser);

    const clerkUser = {
      id: 'clerk_002',
      firstName: 'Alice',
      lastName: 'Smith',
      emailAddresses: [{ emailAddress: 'alice@uni.edu' }],
    };
    const result = await getOrCreateUser(clerkUser);

    expect(userModel.findByAuthId).toHaveBeenCalledWith('clerk_002');
    expect(userModel.create).toHaveBeenCalledWith({
      name: 'Alice Smith',
      email: 'alice@uni.edu',
      authId: 'clerk_002',
    });
    expect(result).toEqual(newUser);
  });

  test('falls back to email as name when first and last name are absent', async () => {
    userModel.findByAuthId.mockResolvedValue(null);
    userModel.create.mockResolvedValue({});

    const clerkUser = {
      id: 'clerk_003',
      firstName: '',
      lastName: '',
      emailAddresses: [{ emailAddress: 'noname@uni.edu' }],
    };
    await getOrCreateUser(clerkUser);

    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'noname@uni.edu' })
    );
  });
});

describe('updateUserRole', () => {
  test.each(['student', 'staff', 'admin'])('succeeds for valid role "%s"', async (role) => {
    const updatedUser = { id: 1, role };
    userModel.updateRole.mockResolvedValue(updatedUser);

    const result = await updateUserRole(1, role);

    expect(userModel.updateRole).toHaveBeenCalledWith(1, role);
    expect(result).toEqual(updatedUser);
  });

  test('throws 400 for an invalid role', async () => {
    await expect(updateUserRole(1, 'superuser')).rejects.toMatchObject({
      message: expect.stringContaining('Invalid role'),
      status: 400,
    });
    expect(userModel.updateRole).not.toHaveBeenCalled();
  });

  test('throws 404 when user is not found', async () => {
    userModel.updateRole.mockResolvedValue(null);

    await expect(updateUserRole(99, 'student')).rejects.toMatchObject({
      message: 'User not found',
      status: 404,
    });
  });
});

// ─── userModel (real implementation with mocked pool) ─────────────────────────

describe('userModel.findByAuthId', () => {
  test('returns user when found', async () => {
    const row = { id: 1, auth_id: 'clerk_001', name: 'Bob' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await realUserModel.findByAuthId('clerk_001');
    expect(result).toEqual(row);
    const [, values] = pool.query.mock.calls[0];
    expect(values[0]).toBe('clerk_001');
  });

  test('returns null when user not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const result = await realUserModel.findByAuthId('nonexistent');
    expect(result).toBeNull();
  });
});

describe('userModel.findById', () => {
  test('returns user when found', async () => {
    const row = { id: 42, name: 'Alice' };
    pool.query.mockResolvedValue({ rows: [row] });
    expect(await realUserModel.findById(42)).toEqual(row);
  });

  test('returns null when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    expect(await realUserModel.findById(999)).toBeNull();
  });
});

describe('userModel.create', () => {
  test('inserts and returns new user with default role student', async () => {
    const row = { id: 1, name: 'Alice', email: 'alice@uni.edu', auth_id: 'clerk_01', role: 'student' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await realUserModel.create({ name: 'Alice', email: 'alice@uni.edu', authId: 'clerk_01' });
    expect(result).toEqual(row);
    const [, values] = pool.query.mock.calls[0];
    expect(values).toContain('Alice');
    expect(values).toContain('student');
  });

  test('inserts with custom role when provided', async () => {
    const row = { id: 2, role: 'staff' };
    pool.query.mockResolvedValue({ rows: [row] });
    await realUserModel.create({ name: 'Bob', email: 'bob@uni.edu', authId: 'clerk_02', role: 'staff' });
    const [, values] = pool.query.mock.calls[0];
    expect(values).toContain('staff');
  });
});

describe('userModel.updateRole', () => {
  test('returns updated user', async () => {
    const row = { id: 1, role: 'admin' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await realUserModel.updateRole(1, 'admin');
    expect(result).toEqual(row);
    const [, values] = pool.query.mock.calls[0];
    expect(values[0]).toBe('admin');
    expect(values[1]).toBe(1);
  });

  test('returns null when user not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    expect(await realUserModel.updateRole(999, 'student')).toBeNull();
  });
});

describe('userModel.findAll', () => {
  test('returns all users ordered by created_at', async () => {
    const rows = [{ id: 2 }, { id: 1 }];
    pool.query.mockResolvedValue({ rows });
    const result = await realUserModel.findAll();
    expect(result).toEqual(rows);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('ORDER BY created_at DESC');
  });
});

// ─── userController ───────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return { params: {}, body: {}, user: { id: 'user-1', role: 'admin' }, ...overrides };
}

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('userController.getMe', () => {
  afterEach(() => jest.restoreAllMocks());

  test('200 with user profile', async () => {
    jest.spyOn(userService, 'getUserProfile').mockResolvedValue({ id: 'user-1', name: 'Alice' });
    const req = makeReq();
    const res = makeRes();
    await userController.getMe(req, res);
    expect(res.json).toHaveBeenCalledWith({ id: 'user-1', name: 'Alice' });
  });

  test('404 when user not found', async () => {
    jest.spyOn(userService, 'getUserProfile').mockRejectedValue(
      Object.assign(new Error('User not found'), { status: 404 })
    );
    const req = makeReq();
    const res = makeRes();
    await userController.getMe(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });
});

describe('userController.updateMyRole', () => {
  afterEach(() => jest.restoreAllMocks());

  test('400 when role is missing from body', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();
    await userController.updateMyRole(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'role is required' });
  });

  test('200 with updated user when role is valid', async () => {
    const updated = { id: 'user-1', role: 'staff' };
    jest.spyOn(userService, 'updateUserRole').mockResolvedValue(updated);
    const req = makeReq({ body: { role: 'staff' } });
    const res = makeRes();
    await userController.updateMyRole(req, res);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test('400 when userService throws invalid role error', async () => {
    jest.spyOn(userService, 'updateUserRole').mockRejectedValue(
      Object.assign(new Error('Invalid role'), { status: 400 })
    );
    const req = makeReq({ body: { role: 'superuser' } });
    const res = makeRes();
    await userController.updateMyRole(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('userController.getAllUsers', () => {
  afterEach(() => jest.restoreAllMocks());

  test('200 with array of users', async () => {
    const users = [{ id: 'u1' }, { id: 'u2' }];
    jest.spyOn(userService, 'getAllUsers').mockResolvedValue(users);
    const req = makeReq();
    const res = makeRes();
    await userController.getAllUsers(req, res);
    expect(res.json).toHaveBeenCalledWith(users);
  });

  test('500 on service error', async () => {
    jest.spyOn(userService, 'getAllUsers').mockRejectedValue(new Error('DB down'));
    const req = makeReq();
    const res = makeRes();
    await userController.getAllUsers(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('userController.adminUpdateRole', () => {
  afterEach(() => jest.restoreAllMocks());

  test('400 when role is missing', async () => {
    const req = makeReq({ params: { id: 'user-1' }, body: {} });
    const res = makeRes();
    await userController.adminUpdateRole(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'role is required' });
  });

  test('200 with updated user on success', async () => {
    const updated = { id: 'user-1', role: 'admin' };
    jest.spyOn(userService, 'adminUpdateUserRole').mockResolvedValue(updated);
    const req = makeReq({ params: { id: 'user-1' }, body: { role: 'admin' } });
    const res = makeRes();
    await userController.adminUpdateRole(req, res);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test('404 when target user not found', async () => {
    jest.spyOn(userService, 'adminUpdateUserRole').mockRejectedValue(
      Object.assign(new Error('User not found'), { status: 404 })
    );
    const req = makeReq({ params: { id: 'bad-id' }, body: { role: 'student' } });
    const res = makeRes();
    await userController.adminUpdateRole(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
