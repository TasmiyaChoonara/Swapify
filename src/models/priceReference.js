const pool = require('../config/db');

/**
 * Returns all rows for a category, ordered by median price ascending.
 */
async function findByCategory(category) {
  const { rows } = await pool.query(
    `SELECT id, category, item_type, min_price, median_price, max_price, currency, source, last_updated
     FROM price_references
     WHERE category = $1
     ORDER BY median_price ASC`,
    [category.toLowerCase()]
  );
  return rows;
}

/**
 * Fuzzy-matches item_type against a search term using ILIKE.
 * Falls back to the whole-category aggregate if nothing matches.
 */
async function findByCategoryAndItem(category, itemTerm) {
  const { rows } = await pool.query(
    `SELECT id, category, item_type, min_price, median_price, max_price, currency, source, last_updated
     FROM price_references
     WHERE category = $1
       AND item_type ILIKE $2
     ORDER BY median_price ASC
     LIMIT 5`,
    [category.toLowerCase(), `%${itemTerm}%`]
  );
  return rows;
}


async function getCategoryRange(category) {
  const { rows } = await pool.query(
    `SELECT
       MIN(min_price)                              AS min_price,
       PERCENTILE_CONT(0.5) WITHIN GROUP
         (ORDER BY median_price)                  AS median_price,
       MAX(max_price)                              AS max_price,
       MAX(last_updated)                           AS last_updated
     FROM price_references
     WHERE category = $1`,
    [category.toLowerCase()]
  );
  return rows[0] ?? null;
}

/**
 * Returns all distinct categories that have seed data.
 */
async function listCategories() {
  const { rows } = await pool.query(
    `SELECT DISTINCT category FROM price_references ORDER BY category`
  );
  return rows.map(r => r.category);
}

module.exports = { findByCategory, findByCategoryAndItem, getCategoryRange, listCategories };
