const { createClerkClient, verifyToken } = require('@clerk/backend');

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
console.log('AUTH MIDDLEWARE LOADED, KEY:', process.env.CLERK_SECRET_KEY?.slice(0, 20));
async function auth(req, res, next) {
   console.log('AUTH CALLED:', req.method, req.path)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const userId = payload.sub;
    console.log('AUTH USER ID:', userId);
    if (!userId) return res.status(401).json({ error: 'Invalid token' });

    const clerkUser = await clerk.users.getUser(userId);
    req.clerkUser = clerkUser;
    req.authId = userId;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Unauthorized', message: err.message });
  }
}

module.exports = auth;