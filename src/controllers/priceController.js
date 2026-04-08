const priceService = require('../services/priceService');

/**
 * GET /api/prices/suggest?category=<category>&item=<item>
 *
 * Returns a suggested price range for a given category (and optional item).
 * Example responses:
 *
 *  200 { category: "electronics", min: 100, median: 350, max: 900,
 *         currency: "ZAR", matchedItem: "Bluetooth headphones", source: "..." }
 *
 *  204 (no content) — category exists but no data
 *  400 { error: "category is required" }
 */
async function suggest(req, res) {
  try {
    const { category, item } = req.query;
    const result = await priceService.suggestPrice(category, item);
    if (!result) {
      return res.status(204).send();   // category not in seed data — handled gracefully
    }
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * GET /api/prices/categories
 * Lists all categories that have price reference data.
 */
async function categories(req, res) {
  try {
    const cats = await priceService.listCategories();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { suggest, categories };
