const jwt = require('jsonwebtoken');

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.decode(token);
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.clerkUser = {
      id: payload.sub,
      emailAddresses: payload.email ? [{ emailAddress: payload.email }] : [],
      firstName: payload.first_name || '',
      lastName: payload.last_name || '',
    };
    req.authId = payload.sub;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Unauthorized', message: err.message });
  }
}

module.exports = auth;