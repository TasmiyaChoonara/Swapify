const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const userService = require('../services/userService');
const { createNotification } = require('../services/notificationService');

router.use(auth);

const OPEN_HOUR = 8;
const CLOSE_HOUR = 18;

async function attachDbUser(req, res, next) {
  try {
    req.user = await userService.getOrCreateUser(req.clerkUser);
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve user', message: err.message });
  }
}

// GET /api/bookings/staff/today — staff/admin only
router.get('/staff/today', attachDbUser, requireRole('staff', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         b.*,
         l.title AS listing_title,
         COALESCE(p.cash_shortfall, 0) AS cash_shortfall,
         COALESCE(p.cash_confirmed, false) AS cash_confirmed,
         p.amount AS online_amount
       FROM bookings b
       LEFT JOIN transactions t  ON t.id = b.trade_id
       LEFT JOIN listings l      ON l.id = t.listing_id
       LEFT JOIN payments p      ON p.transaction_id = t.id
       WHERE b.slot_time::date = CURRENT_DATE
       ORDER BY b.slot_time ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/bookings/:id/receive — mark item_held, notify both parties
router.patch('/:id/receive', attachDbUser, requireRole('staff', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await pool.query(`SELECT * FROM bookings WHERE id = $1`, [id]);
    if (booking.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });

    const result = await pool.query(
      `UPDATE bookings SET status = 'item_held' WHERE id = $1 RETURNING *`,
      [id]
    );
    const b = result.rows[0];

    await createNotification(b.buyer_id, `Your item has been received at the trade facility. Booking #${id}.`);
    await createNotification(b.seller_id, `Your item has been received at the trade facility. Booking #${id}.`);

    res.json(b);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/bookings/:id/confirm-cash — staff confirms cash shortfall paid
router.patch('/:id/confirm-cash', attachDbUser, requireRole('staff', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const bookingRes = await pool.query(
      `SELECT b.*, t.id AS transaction_id FROM bookings b
       LEFT JOIN transactions t ON t.id = b.trade_id
       WHERE b.id = $1`,
      [id]
    );
    if (bookingRes.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });

    const { transaction_id } = bookingRes.rows[0];
    const result = await pool.query(
      `UPDATE payments SET cash_confirmed = true WHERE transaction_id = $1 RETURNING *`,
      [transaction_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/bookings/:id/release — complete booking + transaction, notify both parties
router.patch('/:id/release', attachDbUser, requireRole('staff', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const bookingRes = await pool.query(
      `SELECT b.*, p.cash_shortfall, p.cash_confirmed, t.id AS transaction_id
       FROM bookings b
       LEFT JOIN transactions t ON t.id = b.trade_id
       LEFT JOIN payments p ON p.transaction_id = t.id
       WHERE b.id = $1`,
      [id]
    );
    if (bookingRes.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });

    const b = bookingRes.rows[0];
    if (b.status !== 'item_held') return res.status(400).json({ error: 'Booking must be item_held to release' });

    const shortfall = parseFloat(b.cash_shortfall ?? 0);
    if (shortfall > 0 && !b.cash_confirmed) {
      return res.status(400).json({ error: 'Cash shortfall must be confirmed before release' });
    }

    const updated = await pool.query(
      `UPDATE bookings SET status = 'complete' WHERE id = $1 RETURNING *`,
      [id]
    );

    if (b.transaction_id) {
      await pool.query(`UPDATE transactions SET status = 'complete' WHERE id = $1`, [b.transaction_id]);
    }

    await createNotification(b.buyer_id, `Item released! Transaction complete. You can now leave a rating.`);
    await createNotification(b.seller_id, `Item collected! Transaction complete. You can now leave a rating.`);

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bookings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings ORDER BY slot_time DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bookings/mine
router.get('/mine', async (req, res) => {
  try {
    const clerkId = req.authId;
    const result = await pool.query(
      `SELECT b.*, l.title AS listing_title, t.id AS transaction_id
       FROM bookings b
       LEFT JOIN transactions t ON t.id = b.trade_id
       LEFT JOIN listings l ON l.id = t.listing_id
       WHERE b.buyer_id = $1 OR b.seller_id = $1
       ORDER BY b.slot_time ASC`,
      [clerkId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/bookings
router.post('/', async (req, res) => {
  try {
    const { trade_id, slot_time } = req.body;
    const buyer_clerk_id = req.authId;

    if (!trade_id || !slot_time) return res.status(400).json({ error: 'Missing required fields' });

    const slotDate = new Date(slot_time);
    const hour = slotDate.getHours();
    if (hour < OPEN_HOUR || hour >= CLOSE_HOUR) {
      return res.status(400).json({ error: 'Outside operating hours (8am - 6pm)' });
    }

    const existing = await pool.query('SELECT * FROM bookings WHERE slot_time = $1', [slot_time]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Slot already booked' });

    const sellerRes = await pool.query(
      `SELECT u.auth_id FROM transactions t
       JOIN listings l ON l.id = t.listing_id
       JOIN users u ON u.id = l.seller_id
       WHERE t.id = $1`,
      [trade_id]
    );
    const seller_clerk_id = sellerRes.rows[0]?.auth_id ?? null;

    const result = await pool.query(
      `INSERT INTO bookings (trade_id, buyer_id, seller_id, slot_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [trade_id, buyer_clerk_id, seller_clerk_id, slot_time]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bookings/:trade_id
router.get('/:trade_id', async (req, res) => {
  try {
    const { trade_id } = req.params;
    const result = await pool.query('SELECT * FROM bookings WHERE trade_id = $1', [trade_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
