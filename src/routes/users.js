const { Router } = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const userService = require('../services/userService');
const { getMe, updateMyRole, getAllUsers, adminUpdateRole } = require('../controllers/userController');

const router = Router();

// Attach the DB user to req.user after Clerk verification
async function attachDbUser(req, res, next) {
  try {
    req.user = await userService.getOrCreateUser(req.clerkUser);
    next();
  } catch (err) {
    console.error('attachDbUser error:', err);
    res.status(500).json({ error: 'Failed to resolve user', message: err.message });
  }
}

router.use(auth, attachDbUser);

router.get('/me', getMe);
router.put('/me/role', updateMyRole);

// Admin-only routes
router.get('/', requireRole('admin'), getAllUsers);
router.put('/:id/role', requireRole('admin'), adminUpdateRole);

module.exports = router;
