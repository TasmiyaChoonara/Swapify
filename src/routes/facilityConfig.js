const { Router } = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const userService = require('../services/userService');
const { getConfig, updateDayConfig } = require('../controllers/facilityConfigController');

const router = Router();

async function attachDbUser(req, res, next) {
  try {
    req.user = await userService.getOrCreateUser(req.clerkUser);
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve user', message: err.message });
  }
}

router.get('/', auth, attachDbUser, getConfig);
router.put('/', auth, attachDbUser, requireRole('admin'), updateDayConfig);

module.exports = router;
