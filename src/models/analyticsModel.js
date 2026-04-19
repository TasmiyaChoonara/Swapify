const pool = require('../config/db');

const getAnalytics = async () => {
  const categories = await pool.query(
    'SELECT category, COUNT(*) FROM listings GROUP BY category'
  );

  const transactions = await pool.query(
    `SELECT DATE(created_at), COUNT(*) 
     FROM trades WHERE status='completed'
     GROUP BY DATE(created_at)`
  );

  const flagged = await pool.query(
    'SELECT COUNT(*) FROM listings WHERE is_flagged=true'
  );

  return {
    categories: categories.rows,
    transactions: transactions.rows,
    flagged: flagged.rows[0]
  };
};

module.exports = { getAnalytics };