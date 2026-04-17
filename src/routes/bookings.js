const express = require("express");
const router = express.Router();
const pool = require("../config/db");

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

// CREATE booking
router.post("/", async (req, res) => {
  try {
    const { trade_id, buyer_id, seller_id, slot_time } = req.body;

    if (!trade_id || !buyer_id || !seller_id || !slot_time) {
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

    // Insert booking
    const result = await pool.query(
      `INSERT INTO bookings (trade_id, buyer_id, seller_id, slot_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [trade_id, buyer_id, seller_id, slot_time]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET booking for a specific trade
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