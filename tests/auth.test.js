'use strict';

// Mock @clerk/backend before requiring auth middleware.
// The clerkInstance is created once inside the factory so every call to
// createClerkClient() — including the one in auth.js at module load — returns
// the exact same object with the same getUser jest.fn().
jest.mock('@clerk/backend', () => {
  const clerkInstance = { users: { getUser: jest.fn() } };
  return {
    createClerkClient: jest.fn(() => clerkInstance),
    verifyToken: jest.fn(),
  };
});

const { verifyToken, createClerkClient } = require('@clerk/backend');
const auth = require('../src/middleware/auth');

// Now this is the same instance auth.js holds
const mockGetUser = createClerkClient().users.getUser;

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auth middleware', () => {
  test('returns 401 when Authorization header is missing', async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid Authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when Authorization header does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic sometoken' } };
    const res = makeRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid Authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when verifyToken throws (malformed token)', async () => {
    verifyToken.mockRejectedValue(new Error('jwt malformed'));

    const req = { headers: { authorization: 'Bearer bad.token.here' } };
    const res = makeRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized', message: 'jwt malformed' });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() and attaches user when token is valid', async () => {
    const fakePayload = { sub: 'user_abc123' };
    const fakeClerkUser = { id: 'user_abc123', firstName: 'Alice' };

    verifyToken.mockResolvedValue(fakePayload);
    mockGetUser.mockResolvedValue(fakeClerkUser);

    const req = { headers: { authorization: 'Bearer valid.token.here' } };
    const res = makeRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.authId).toBe('user_abc123');
    expect(req.clerkUser).toEqual(fakeClerkUser);
    expect(res.status).not.toHaveBeenCalled();
  });
});
