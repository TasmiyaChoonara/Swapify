const pool = require('../config/db');

// Builds a SELECT with images aggregated as a JSON array
const BASE_SELECT = `
  SELECT
    l.*,
    COALESCE(
      JSON_AGG(li.image_url ORDER BY li.created_at)
      FILTER (WHERE li.image_url IS NOT NULL),
      '[]'
    ) AS images
  FROM listings l
  LEFT JOIN listing_images li ON li.listing_id = l.id
`;

async function findAll({ category, type, condition, status = 'active' } = {}) {
  const conditions = ['l.status = $1'];
  const values = [status];
  let i = 2;

  if (category) { conditions.push(`l.category = $${i++}`); values.push(category); }
  if (type)     { conditions.push(`l.type = $${i++}`);     values.push(type); }
  if (condition){ conditions.push(`l.condition = $${i++}`); values.push(condition); }

  const sql = `
    ${BASE_SELECT}
    WHERE ${conditions.join(' AND ')}
    GROUP BY l.id
    ORDER BY l.created_at DESC
  `;
  const { rows } = await pool.query(sql, values);
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(
    `${BASE_SELECT} WHERE l.id = $1 GROUP BY l.id`,
    [id]
  );
  return rows[0] || null;
}

async function findBySeller(sellerId) {
  const { rows } = await pool.query(
    `${BASE_SELECT} WHERE l.seller_id = $1 GROUP BY l.id ORDER BY l.created_at DESC`,
    [sellerId]
  );
  return rows;
}

async function create({ sellerId, title, description, price, condition, type, category }) {
  const { rows } = await pool.query(
    `INSERT INTO listings (seller_id, title, description, price, condition, type, category)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [sellerId, title, description, price, condition, type, category]
  );
  return rows[0];
}

async function updateStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE listings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0] || null;
}

async function update(id, { title, description, price, condition, type, category, status }) {
  const fields = [];
  const values = [];
  let i = 1;

  if (title !== undefined)       { fields.push(`title = $${i++}`);       values.push(title); }
  if (description !== undefined) { fields.push(`description = $${i++}`); values.push(description); }
  if (price !== undefined)       { fields.push(`price = $${i++}`);       values.push(price); }
  if (condition !== undefined)   { fields.push(`condition = $${i++}`);   values.push(condition); }
  if (type !== undefined)        { fields.push(`type = $${i++}`);        values.push(type); }
  if (category !== undefined)    { fields.push(`category = $${i++}`);    values.push(category); }
  if (status !== undefined)      { fields.push(`status = $${i++}`);      values.push(status); }

  if (fields.length === 0) return findById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE listings SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM listings WHERE id = $1', [id]);
  return rowCount > 0;
}

async function addImage(listingId, imageUrl) {
  const { rows } = await pool.query(
    `INSERT INTO listing_images (listing_id, image_url) VALUES ($1, $2) RETURNING *`,
    [listingId, imageUrl]
  );
  return rows[0];
}

module.exports = { findAll, findById, findBySeller, create, update, updateStatus, addImage, delete: remove };
