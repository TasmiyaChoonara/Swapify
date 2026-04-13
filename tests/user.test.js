'use strict';

// Mock the user model so no real DB connection is needed
jest.mock('../src/models/user');

const userModel = require('../src/models/user');
const { getOrCreateUser, updateUserRole } = require('../src/services/userService');

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
