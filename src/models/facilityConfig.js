const pool = require('../config/db');

async function findAll() {
  const { rows } = await pool.query(
    'SELECT * FROM facility_config ORDER BY day_of_week ASC'
  );
  return rows;
}

async function upsertByDay({ dayOfWeek, openTime, closeTime, slotCapacity, updatedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO facility_config (day_of_week, open_time, close_time, slot_capacity, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (day_of_week)
     DO UPDATE SET
       open_time     = EXCLUDED.open_time,
       close_time    = EXCLUDED.close_time,
       slot_capacity = EXCLUDED.slot_capacity,
       updated_by    = EXCLUDED.updated_by,
       updated_at    = NOW()
     RETURNING *`,
    [dayOfWeek, openTime, closeTime, slotCapacity, updatedBy]
  );
  return rows[0];
}

module.exports = { findAll, upsertByDay };
