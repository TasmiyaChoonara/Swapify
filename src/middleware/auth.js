const { verifyToken } = require('@clerk/backend');

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const userId = payload.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Build clerkUser from JWT payload directly - no API call needed
    req.clerkUser = {
      id: userId,
      emailAddresses: payload.email ? [{ emailAddress: payload.email }] : [],
      firstName: payload.first_name || '',
      lastName: payload.last_name || '',
    };
    req.authId = userId;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Unauthorized', message: err.message });
  }
}

module.exports = auth;
