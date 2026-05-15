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

router.get('/', async (req, res) => {
  try {
    const { listing_id } = req.query;
    if (!listing_id) return res.status(400).json({ error: 'listing_id is required' });

    const { rows } = await pool.query(
      `SELECT * FROM transactions WHERE listing_id = $1 AND buyer_id = $2`,
      [listing_id, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { listingId, type } = req.body;
    if (!listingId || !type) return res.status(400).json({ error: 'listingId and type are required' });

    const listingCheck = await pool.query(
      `SELECT status FROM listings WHERE id = $1`,
      [listingId]
    );
    if (listingCheck.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    if (listingCheck.rows[0].status === 'sold') {
      return res.status(400).json({ error: 'This item has already been sold.' });
    }

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

router.get('/my-purchases', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, l.title as listing_title, l.price, l.status as listing_status, u.name as seller_name, u.id as seller_db_id FROM transactions t JOIN listings l ON l.id = t.listing_id JOIN users u ON u.id = l.seller_id WHERE t.buyer_id = $1 AND t.type = 'sale' ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// US10 — seller completed sales history
router.get('/mine/sold', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, l.title AS listing_title, l.price, l.category,
              u.name AS buyer_name, p.online_amount, p.cash_shortfall
       FROM transactions t
       JOIN listings l ON l.id = t.listing_id
       JOIN users u ON u.id = t.buyer_id
       LEFT JOIN payments p ON p.transaction_id = t.id
       WHERE l.seller_id = $1 AND t.status = 'complete'
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
