const pool = require('../config/db');

async function findByTransactionId(transactionId) {
  const { rows } = await pool.query(
    'SELECT * FROM payments WHERE transaction_id = $1',
    [transactionId]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ transactionId, amount, onlineAmount, cashShortfall }) {
  const { rows } = await pool.query(
    `INSERT INTO payments (transaction_id, amount, online_amount, cash_shortfall, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [transactionId, amount, onlineAmount, cashShortfall]
  );
  return rows[0];
}

async function markPaid(id, paypalOrderId) {
  const { rows } = await pool.query(
    `UPDATE payments
     SET status = 'paid', paypal_order_id = $2, paid_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, paypalOrderId]
  );
  return rows[0] || null;
}

async function markFailed(id) {
  const { rows } = await pool.query(
    `UPDATE payments
     SET status = 'failed', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { findByTransactionId, findById, create, markPaid, markFailed };
