const { Router } = require('express');
const auth = require('../middleware/auth');
const userService = require('../services/userService');
const pool = require('../config/db');

const router = Router();

async function attachDbUser(req, res, next) {
  try {
    req.user = await userService.getOrCreateUser(req.clerkUser);
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve user', message: err.message });
  }
}

router.use(auth, attachDbUser);

router.post('/', async (req, res) => {
  try {
    const { listingId, type } = req.body;
    if (!listingId || !type) return res.status(400).json({ error: 'listingId and type are required' });

    const { rows } = await pool.query(
      `INSERT INTO transactions (listing_id, buyer_id, type, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [listingId, req.user.id, type]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
