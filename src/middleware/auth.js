const { createClerkClient, verifyToken } = require('@clerk/backend');
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const userId = payload.sub;
    if (!userId) return res.status(401).json({ error: 'Invalid token' });

    const clerkUser = await clerk.users.getUser(userId);
    req.clerkUser = clerkUser;
    req.authId = userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', message: err.message });
  }
}

module.exports = auth;