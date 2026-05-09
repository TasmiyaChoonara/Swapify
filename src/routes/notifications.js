const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

router.use(auth);

// GET unread notifications for current user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_clerk_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.authId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH mark one notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_clerk_id = $2 RETURNING *`,
      [id, req.authId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH mark all notifications as read
router.patch('/read-all', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read = true WHERE user_clerk_id = $1`,
      [req.authId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
