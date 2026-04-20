'use strict';

jest.mock('jsonwebtoken', () => ({
  decode: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const auth = require('../src/middleware/auth');

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

  test('returns 401 when token has no payload', async () => {
    jwt.decode.mockReturnValue(null);

    const req = { headers: { authorization: 'Bearer bad.token.here' } };
    const res = makeRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token has no sub claim', async () => {
    jwt.decode.mockReturnValue({ email: 'test@test.com' });

    const req = { headers: { authorization: 'Bearer token.without.sub' } };
    const res = makeRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() and attaches user when token is valid', async () => {
    jwt.decode.mockReturnValue({
      sub: 'user_abc123',
      email: 'alice@test.com',
      first_name: 'Alice',
      last_name: 'Smith',
    });

    const req = { headers: { authorization: 'Bearer valid.token.here' } };
    const res = makeRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.authId).toBe('user_abc123');
    expect(req.clerkUser.id).toBe('user_abc123');
    expect(res.status).not.toHaveBeenCalled();
  });
});
