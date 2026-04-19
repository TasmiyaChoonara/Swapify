const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const auth = require("../middleware/auth");

router.use(auth);

const OPEN_HOUR = 8;
const CLOSE_HOUR = 18;

// GET all bookings
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM bookings");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET all bookings for the currently logged in user (as buyer or seller)
router.get("/mine", async (req, res) => {
  try {
    const clerkId = req.authId;
    const result = await pool.query(
      `SELECT b.*, l.title as listing_title
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
    res.status(500).json({ error: "Server error" });
  }
});

// CREATE booking
router.post("/", async (req, res) => {
  try {
    const { trade_id, slot_time } = req.body;
    const buyer_clerk_id = req.authId;

    if (!trade_id || !slot_time) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const slotDate = new Date(slot_time);
    const hour = slotDate.getHours();

    // Validate operating hours
    if (hour < OPEN_HOUR || hour >= CLOSE_HOUR) {
      return res.status(400).json({ error: "Outside operating hours (8am - 6pm)" });
    }

    // Check for double booking
    const existing = await pool.query(
      "SELECT * FROM bookings WHERE slot_time = $1",
      [slot_time]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Slot already booked" });
    }

    // Look up the seller's Clerk auth_id via the transaction -> listing -> users chain
    const sellerRes = await pool.query(
      `SELECT u.auth_id FROM transactions t
       JOIN listings l ON l.id = t.listing_id
       JOIN users u ON u.id = l.seller_id
       WHERE t.id = $1`,
      [trade_id]
    );

    const seller_clerk_id = sellerRes.rows[0]?.auth_id ?? null;

    // Insert booking
    const result = await pool.query(
      `INSERT INTO bookings (trade_id, buyer_id, seller_id, slot_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [trade_id, buyer_clerk_id, seller_clerk_id, slot_time]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET bookings for a specific trade
router.get("/:trade_id", async (req, res) => {
  try {
    const { trade_id } = req.params;
    const result = await pool.query(
      "SELECT * FROM bookings WHERE trade_id = $1",
      [trade_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;