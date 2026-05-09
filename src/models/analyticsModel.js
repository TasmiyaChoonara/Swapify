const pool = require('../config/db');

const getAnalytics = async () => {
  // Most popular categories by listing count
  const categories = await pool.query(`
    SELECT category, COUNT(*) AS count
    FROM listings
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC
  `);

  // Completed transactions over time (last 30 days)
  const transactions = await pool.query(`
    SELECT DATE(created_at) AS date, COUNT(*) AS count
    FROM transactions
    WHERE status = 'complete'
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);

  // Removed/moderated listings count
  const flagged = await pool.query(`
    SELECT COUNT(*) AS count
    FROM listings
    WHERE status = 'removed'
  `);

  // Total listings by status
  const listingStats = await pool.query(`
    SELECT status, COUNT(*) AS count
    FROM listings
    GROUP BY status
  `);

  // Total users
  const userCount = await pool.query(`SELECT COUNT(*) AS count FROM users`);

  // Total completed payments
  const paymentStats = await pool.query(`
    SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
    FROM payments
    GROUP BY status
  `);

  // ANA-01: Facility utilisation — bookings vs capacity per day (last 30 days)
  const facilityUtilisation = await pool.query(`
    SELECT
      DATE(b.slot_time) AS date,
      COUNT(b.id) AS booked,
      COALESCE(fc.slot_capacity, 10) AS capacity,
      ROUND(COUNT(b.id)::numeric / NULLIF(COALESCE(fc.slot_capacity, 10), 0) * 100, 1) AS utilisation_pct
    FROM bookings b
    LEFT JOIN facility_config fc
      ON fc.day_of_week = EXTRACT(DOW FROM b.slot_time)
    WHERE b.slot_time >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(b.slot_time), fc.slot_capacity
    ORDER BY date ASC
  `);

  // ANA-02: Moderation report — flagged/removed ratings grouped by week (last 30 days)
  let moderationReport = { rows: [] };
  try {
    moderationReport = await pool.query(`
      SELECT
        DATE_TRUNC('week', created_at) AS week,
        COUNT(*) FILTER (WHERE flagged = true) AS flagged_count,
        COUNT(*) FILTER (WHERE removed = true) AS removed_count
      FROM ratings
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week ASC
    `);
  } catch {
    // ratings table may not have flagged/removed columns yet — skip gracefully
  }

  return {
    categories: categories.rows,
    transactions: transactions.rows,
    flagged: flagged.rows[0],
    listingStats: listingStats.rows,
    userCount: userCount.rows[0],
    paymentStats: paymentStats.rows,
    facilityUtilisation: facilityUtilisation.rows,
    moderationReport: moderationReport.rows,
  };
};

const getAnalyticsCSV = async () => {
  const data = await getAnalytics();
  const lines = [];

  lines.push('=== CATEGORY POPULARITY ===');
  lines.push('Category,Listing Count');
  data.categories.forEach(r => lines.push(`${r.category},${r.count}`));
  lines.push('');

  lines.push('=== COMPLETED TRANSACTIONS (LAST 30 DAYS) ===');
  lines.push('Date,Count');
  data.transactions.forEach(r => lines.push(`${r.date},${r.count}`));
  lines.push('');

  lines.push('=== LISTING STATUS SUMMARY ===');
  lines.push('Status,Count');
  data.listingStats.forEach(r => lines.push(`${r.status},${r.count}`));
  lines.push('');

  lines.push('=== PAYMENT SUMMARY ===');
  lines.push('Status,Count,Total (R)');
  data.paymentStats.forEach(r => lines.push(`${r.status},${r.count},${parseFloat(r.total).toFixed(2)}`));
  lines.push('');

  lines.push('=== MODERATION SUMMARY ===');
  lines.push('Removed Listings');
  lines.push(data.flagged.count);
  lines.push('');

  lines.push('=== FACILITY UTILISATION (LAST 30 DAYS) ===');
  lines.push('Date,Booked Slots,Capacity,Utilisation %');
  data.facilityUtilisation.forEach(r => lines.push(`${r.date},${r.booked},${r.capacity},${r.utilisation_pct}`));
  lines.push('');

  lines.push('=== MODERATION TRENDS (LAST 30 DAYS) ===');
  lines.push('Week,Flagged,Removed');
  data.moderationReport.forEach(r => lines.push(`${r.week},${r.flagged_count},${r.removed_count}`));
  lines.push('');

  lines.push('=== PLATFORM TOTALS ===');
  lines.push('Total Users');
  lines.push(data.userCount.count);

  return lines.join('\n');
};

module.exports = { getAnalytics, getAnalyticsCSV };