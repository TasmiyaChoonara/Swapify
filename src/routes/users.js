const { Router } = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const userService = require('../services/userService');
const { getMe, updateMyRole, getAllUsers, adminUpdateRole } = require('../controllers/userController');

const router = Router();

// Public — no auth required.  Returns count of completed transactions where the
// given user was the seller, used by ListingDetail to show "N completed trades".
router.get('/:userId/completed-transactions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM transactions t
       JOIN listings l ON l.id = t.listing_id
       JOIN users u ON u.id = l.seller_id
       WHERE u.id = $1 AND t.status = 'complete'`,
      [req.params.userId]
    );
    res.json({ count: Number(rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

router.get("/by-clerk/:clerkId", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name FROM users WHERE auth_id = $1",
      [req.params.clerkId]
    )
    if (rows.length === 0) return res.status(404).json({ error: "User not found" })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete("/:id", auth, attachDbUser, requireRole("admin"), async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
