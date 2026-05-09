const { Router } = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
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

router.post('/', auth, attachDbUser, async (req, res) => {
  const { transaction_id, reviewee_id, score, comment } = req.body;
  if (!transaction_id || !reviewee_id || !score) {
    return res.status(400).json({ error: 'transaction_id, reviewee_id, and score are required' });
  }
  if (score < 1 || score > 5) {
    return res.status(400).json({ error: 'score must be between 1 and 5' });
  }
  try {
    const txRes = await pool.query(
      `SELECT t.*, t.buyer_id, l.seller_id
       FROM transactions t
       JOIN listings l ON l.id = t.listing_id
       WHERE t.id = $1`,
      [transaction_id]
    );
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    const tx = txRes.rows[0];
    if (tx.status !== 'complete') return res.status(400).json({ error: 'Transaction is not complete' });
    const reviewerId = req.user.id;
    if (reviewerId !== tx.buyer_id && reviewerId !== tx.seller_id) {
      return res.status(403).json({ error: 'Forbidden: you are not a party to this transaction' });
    }
    const dupCheck = await pool.query(
      `SELECT id FROM ratings WHERE transaction_id = $1 AND reviewer_id = $2`,
      [transaction_id, reviewerId]
    );
    if (dupCheck.rows.length > 0) return res.status(400).json({ error: 'You have already rated this transaction' });
    const result = await pool.query(
      `INSERT INTO ratings (transaction_id, reviewer_id, reviewee_id, score, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [transaction_id, reviewerId, reviewee_id, score, comment ?? null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.name AS reviewer_name
       FROM ratings r
       JOIN users u ON u.id = r.reviewer_id
       WHERE r.reviewee_id = $1 AND r.removed = false
       ORDER BY r.created_at DESC`,
      [req.params.userId]
    );
    const rows = result.rows;
    const average = rows.length > 0
      ? rows.reduce((sum, r) => sum + Number(r.score), 0) / rows.length
      : null;
    return res.json({ ratings: rows, average, count: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/', auth, attachDbUser, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, reviewer.name AS reviewer_name, reviewee.name AS reviewee_name
       FROM ratings r
       JOIN users reviewer ON reviewer.id = r.reviewer_id
       JOIN users reviewee ON reviewee.id = r.reviewee_id
       ORDER BY r.created_at DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/flag', auth, attachDbUser, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE ratings SET flagged = NOT flagged WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rating not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/remove', auth, attachDbUser, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE ratings SET removed = true WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rating not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
