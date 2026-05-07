const jwt = require('jsonwebtoken');

async function auth(req, res, next) {
  console.log('AUTH CALLED:', req.method, req.path);
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  const payload = jwt.decode(token);

  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  if (!payload.sub) return res.status(401).json({ error: 'Invalid token' });

  req.authId = payload.sub;
  req.clerkUser = {
    id: payload.sub,
    emailAddresses: payload.email ? [{ emailAddress: payload.email }] : [],
    firstName: payload.first_name ?? null,
    lastName: payload.last_name ?? null,
  };

  next();
}

module.exports = auth;
