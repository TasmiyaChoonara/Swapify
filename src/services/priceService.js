/**
 * priceService.js
 *
 * Provides price suggestions for the SA campus marketplace.
 *
 * DATA SOURCE
 * -----------
 * Stats SA (statssa.gov.za) publishes CPI data only as Excel/PDF — no REST API.
 * data.gov.za has no per-product retail prices.
 * World Bank SA CPI covers aggregate indices, not item-level prices.
 *
 * Approach: curated seed data (scripts/seedPrices.js) drawn from SA retail
 * sources (Takealot, Loot, OLX ZA, Facebook Marketplace ZA) representing
 * typical student second-hand resale prices in ZAR. Updated via re-running
 * the seed script when prices drift.
 *
 * Suggestion logic:
 *  1. If `item` query param is given, fuzzy-match item_type in the category.
 *     If ≥1 row matches, aggregate those rows into a range.
 *  2. If no item match (or no item param), fall back to the full-category range.
 *  3. If the category has no data at all, return null (caller handles gracefully).
 */

const priceModel = require('../models/priceReference');

/**
 * Collapses an array of price_reference rows into a single {min, median, max} range.
 */
function aggregateRows(rows) {
  if (!rows.length) return null;
  const min    = Math.min(...rows.map(r => parseFloat(r.min_price)));
  const max    = Math.max(...rows.map(r => parseFloat(r.max_price)));
  const median = rows.reduce((sum, r) => sum + parseFloat(r.median_price), 0) / rows.length;
  return {
    min:    Math.round(min),
    median: Math.round(median),
    max:    Math.round(max),
  };
}

/**
 * Main entry point called by the controller.
 *
 * @param {string} category  - listing category slug (e.g. "textbooks")
 * @param {string} [item]    - optional item description for fuzzy match
 * @returns {{ min, median, max, currency, matchedItem, category, source } | null}
 */
async function suggestPrice(category, item) {
  if (!category) {
    throw Object.assign(new Error('category is required'), { status: 400 });
  }

  let range = null;
  let matchedItem = null;

  // Step 1: try item fuzzy match
  if (item && item.trim()) {
    const matched = await priceModel.findByCategoryAndItem(category, item.trim());
    if (matched.length > 0) {
      // If only one row matches exactly enough, use it directly; otherwise aggregate
      // the closest matches (sorted by median ASC by the model).
      // Prefer the closest single match so a search for "laptop" doesn't pull
      // in "laptop charger" and skew the range downwards.
      const terms  = item.trim().toLowerCase().split(/\s+/)
      const scored = matched.map(r => {
        const name  = r.item_type.toLowerCase()
        const score = terms.filter(t => name.includes(t)).length
        return { ...r, score }
      }).sort((a, b) => b.score - a.score)

      const topScore  = scored[0].score
      const topMatches = scored.filter(r => r.score === topScore)
      range       = aggregateRows(topMatches)
      matchedItem = topMatches.length === 1 ? topMatches[0].item_type : null
    }
  }

  // Step 2: fall back to full-category aggregate
  if (!range) {
    const catRow = await priceModel.getCategoryRange(category);
    if (catRow && catRow.min_price !== null) {
      range = {
        min:    Math.round(parseFloat(catRow.min_price)),
        median: Math.round(parseFloat(catRow.median_price)),
        max:    Math.round(parseFloat(catRow.max_price)),
      };
    }
  }

  if (!range) return null;   // category not in seed data

  return {
    category,
    matchedItem,
    min:      range.min,
    median:   range.median,
    max:      range.max,
    currency: 'ZAR',
    source:   'Curated SA campus resale data (Takealot, Loot, OLX ZA)',
  };
}

async function listCategories() {
  return priceModel.listCategories();
}

module.exports = { suggestPrice, listCategories };
