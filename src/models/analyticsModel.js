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

  return {
    categories: categories.rows,
    transactions: transactions.rows,
    flagged: flagged.rows[0],
    listingStats: listingStats.rows,
    userCount: userCount.rows[0],
    paymentStats: paymentStats.rows,
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
  lines.push('=== PLATFORM TOTALS ===');
  lines.push('Total Users');
  lines.push(data.userCount.count);

  return lines.join('\n');
};

module.exports = { getAnalytics, getAnalyticsCSV };
