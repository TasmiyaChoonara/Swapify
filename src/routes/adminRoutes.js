const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const userService = require('../services/userService');
const { getAnalytics, exportAnalyticsCSV } = require('../controllers/adminController');

async function attachDbUser(req, res, next) {
  try {
    req.user = await userService.getOrCreateUser(req.clerkUser);
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve user', message: err.message });
  }
}

router.use(auth, attachDbUser);

router.get('/analytics', requireRole('admin', 'staff'), getAnalytics);
router.get('/analytics/export', requireRole('admin', 'staff'), exportAnalyticsCSV);

module.exports = router;
