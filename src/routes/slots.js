const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const auth = require("../middleware/auth");

router.use(auth);

const OPEN_HOUR = 8;
const CLOSE_HOUR = 18;

// GET available slots
router.get("/", async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    // Generate slots (hourly)
    let slots = [];
    for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
      const slot = new Date(`${date}T${hour.toString().padStart(2, "0")}:00:00`);
      slots.push(slot);
    }

    // Get booked slots from DB
    const result = await pool.query(
      "SELECT slot_time FROM bookings WHERE DATE(slot_time) = $1",
      [date]
    );

    const bookedSlots = result.rows.map(r =>
      new Date(r.slot_time).toISOString()
    );

    // Mark availability
    const availableSlots = slots.map(slot => ({
      time: slot,
      available: !bookedSlots.includes(slot.toISOString())
    }));

    res.json(availableSlots);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;