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
    res.status(500).json({ error: 'Failed to resolve user' });
  }
}

router.use(auth, attachDbUser);

// GET /api/saved — get all saved listings for current user
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id AS saved_id, s.created_at AS saved_at,
              l.id, l.title, l.price, l.condition, l.type, l.category, l.status,
              u.name AS seller_name
       FROM saved_listings s
       JOIN listings l ON l.id = s.listing_id
       JOIN users u ON u.id = l.seller_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/saved/:listingId — save a listing
router.post('/:listingId', async (req, res) => {
  try {
    const { listingId } = req.params;
    const { rows } = await pool.query(
      `INSERT INTO saved_listings (user_id, listing_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, listing_id) DO NOTHING
       RETURNING *`,
      [req.user.id, listingId]
    );
    if (rows.length === 0) return res.status(409).json({ error: 'Already saved' });
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/saved/:listingId — remove a saved listing
router.delete('/:listingId', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM saved_listings WHERE user_id = $1 AND listing_id = $2`,
      [req.user.id, req.params.listingId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
