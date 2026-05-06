const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userService = require('../services/userService');
const { createThread } = require('../controllers/threadController');

async function attachDbUser(req, res, next) {
  try {
    req.user = await userService.getOrCreateUser(req.clerkUser);
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve user', message: err.message });
  }
}
router.get('/listing/:listingId', auth, attachDbUser, async (req, res) => {
  try {
    const pool = require('../config/db');
    const { rows } = await pool.query(
      'SELECT * FROM threads WHERE listing_id = $1 AND seller_id = $2',
      [req.params.listingId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, attachDbUser, createThread);

module.exports = router;