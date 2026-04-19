const pool = require('../config/db');

const getOrCreateThread = async (listingId, buyerId, sellerId) => {
  const existing = await pool.query(
    'SELECT * FROM threads WHERE listing_id=$1 AND buyer_id=$2 AND seller_id=$3',
    [listingId, buyerId, sellerId]
  );

  if (existing.rows.length > 0) return existing.rows[0];

  const result = await pool.query(
    'INSERT INTO threads (listing_id, buyer_id, seller_id) VALUES ($1,$2,$3) RETURNING *',
    [listingId, buyerId, sellerId]
  );

  return result.rows[0];
};

module.exports = { getOrCreateThread };