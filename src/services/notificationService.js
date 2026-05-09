const pool = require('../config/db');

async function createNotification(clerkId, message) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_clerk_id, message) VALUES ($1, $2)`,
      [clerkId, message]
    );
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

module.exports = { createNotification };
