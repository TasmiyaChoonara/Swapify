const pool = require('../config/db');

async function findByAuthId(authId) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE auth_id = $1',
    [authId]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function create({ name, email, authId, role = 'student' }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, auth_id, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, email, authId, role]
  );
  return rows[0];
}

async function updateRole(id, role) {
  const { rows } = await pool.query(
    `UPDATE users
     SET role = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [role, id]
  );
  return rows[0] || null;
}

async function findAll() {
  const { rows } = await pool.query(
    'SELECT * FROM users ORDER BY created_at DESC'
  );
  return rows;
}

module.exports = { findByAuthId, findById, findAll, create, updateRole };
