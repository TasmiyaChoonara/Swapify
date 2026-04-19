/**
 * Seed script: SA campus marketplace price reference data
 *
 * DATA SOURCE DECISION
 * --------------------
 * Stats SA (statssa.gov.za) publishes CPI data only as Excel/PDF downloads —
 * there is no public REST API. data.gov.za has no product-level retail prices.
 * The World Bank API covers SA aggregate CPI indices, not per-item prices.
 *
 * Decision: manually curated seed data researched from SA retail sources:
 *   - Takealot.com (electronics, textbooks)
 *   - Loot.co.za  (textbooks)
 *   - PNA / Campus bookshops (stationery, textbooks)
 *   - OLX / Facebook Marketplace SA (second-hand furniture, clothing)
 *   - Checkers / Game / Incredible Connection (appliances, electronics)
 *
 * All prices are second-hand / student re-sale estimates in ZAR.
 * These represent typical campus-to-campus transaction ranges, not retail.
 * Update this file when prices drift significantly (suggested: annually).
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ...(process.env.NODE_ENV === 'production' && { ssl: { rejectUnauthorized: false } }),
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'campusmarket',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'password123',
    });

const SOURCE = 'Curated from Takealot, Loot, OLX ZA, Facebook Marketplace ZA (2024–2025)';

// Each row: [category, item_type, min_price, median_price, max_price]
// Prices reflect typical second-hand student resale in ZAR.
const PRICE_DATA = [
  // ── Textbooks ──────────────────────────────────────────────────────────
  ['textbooks', 'First-year general textbook',        80,   200,  400],
  ['textbooks', 'Upper-year / specialist textbook',  150,   350,  700],
  ['textbooks', 'Medical / law / engineering text',  300,   600, 1200],
  ['textbooks', 'Novel / fiction (prescribed)',       30,    60,  120],
  ['textbooks', 'Study guide / notes pack',           20,    50,  120],
  ['textbooks', 'Stationery bundle',                  30,    80,  200],
  ['textbooks', 'Scientific calculator',             100,   250,  500],

  // ── Electronics ────────────────────────────────────────────────────────
  ['electronics', 'Laptop (entry level)',            1500,  3500, 7000],
  ['electronics', 'Laptop (mid-range)',              3000,  6000,10000],
  ['electronics', 'Laptop charger / adapter',         80,   200,  500],
  ['electronics', 'Smartphone (budget)',              500,  1200, 2500],
  ['electronics', 'Smartphone (mid-range)',          1500,  3000, 6000],
  ['electronics', 'Bluetooth headphones',             100,   350,  900],
  ['electronics', 'Wired earphones',                   20,    60,  150],
  ['electronics', 'USB hub / accessories',             50,   120,  300],
  ['electronics', 'External hard drive / SSD',        200,   450,  900],
  ['electronics', 'Tablet / iPad',                    500,  1800, 4500],
  ['electronics', 'Computer monitor',                 400,  1000, 2500],
  ['electronics', 'Keyboard & mouse',                  80,   200,  500],
  ['electronics', 'Extension cord / surge protector',  50,   120,  300],
  ['electronics', 'Desk lamp',                         60,   120,  300],
  ['electronics', 'Portable speaker',                 100,   250,  600],
  ['electronics', 'Webcam',                           100,   250,  600],

  // ── Furniture ──────────────────────────────────────────────────────────
  ['furniture', 'Desk',                               200,   500, 1200],
  ['furniture', 'Office / study chair',               150,   400, 1000],
  ['furniture', 'Bookshelf',                          100,   300,  700],
  ['furniture', 'Mini fridge',                        500,  1000, 2000],
  ['furniture', 'Microwave oven',                     300,   600, 1200],
  ['furniture', 'Kettle',                              80,   160,  350],
  ['furniture', 'Toaster',                             60,   130,  280],
  ['furniture', 'Bedside table',                       80,   200,  500],
  ['furniture', 'Lamp / floor lamp',                   60,   150,  400],
  ['furniture', 'Storage box / bin',                   40,    90,  200],
  ['furniture', 'Laundry basket',                      40,    80,  180],
  ['furniture', 'Mirror',                              80,   180,  400],
  ['furniture', 'Coffee table',                       150,   350,  800],

  // ── Clothing ───────────────────────────────────────────────────────────
  ['clothing', 'Formal shirt / blouse',                50,   120,  300],
  ['clothing', 'Jeans / trousers',                     60,   150,  350],
  ['clothing', 'Jacket / hoodie',                      80,   200,  500],
  ['clothing', 'Winter coat',                         150,   350,  800],
  ['clothing', 'Sneakers / shoes',                    100,   300,  700],
  ['clothing', 'Dress / skirt',                        60,   150,  350],
  ['clothing', 'Sports kit / gym wear',                60,   140,  300],
  ['clothing', 'Backpack / bag',                       80,   200,  500],
  ['clothing', 'Formal wear (suit / dress)',          200,   500, 1200],
  ['clothing', 'T-shirts (bundle)',                    50,   100,  220],

  // ── Sports ─────────────────────────────────────────────────────────────
  ['sports', 'Bicycle',                              1000,  2500, 6000],
  ['sports', 'Bicycle lock / accessories',             80,   160,  350],
  ['sports', 'Gym bag',                                60,   140,  300],
  ['sports', 'Yoga mat',                               60,   130,  280],
  ['sports', 'Dumbbells (pair)',                      100,   250,  600],
  ['sports', 'Football / soccer ball',                 80,   160,  350],
  ['sports', 'Cricket / rugby equipment',             100,   300,  700],
  ['sports', 'Tennis / squash racket',                100,   280,  600],
  ['sports', 'Running shoes',                         150,   350,  800],
  ['sports', 'Skipping rope',                          20,    50,  120],

  // ── Other ───────────────────────────────────────────────────────────────
  ['other', 'Kitchen utensils / cutlery set',          60,   150,  350],
  ['other', 'Bedding set',                            150,   350,  700],
  ['other', 'Towels (set of 2)',                       60,   130,  300],
  ['other', 'Cleaning supplies bundle',                50,   100,  200],
  ['other', 'Board game',                              60,   130,  280],
  ['other', 'Musical instrument (basic)',             200,   600, 1500],
  ['other', 'Art supplies kit',                        80,   180,  400],
  ['other', 'Printer',                                300,   700, 1500],
  ['other', 'Bicycle helmet',                         100,   220,  450],
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log(`Seeding ${PRICE_DATA.length} price reference rows…`);

    await client.query('BEGIN');

    for (const [category, item_type, min_price, median_price, max_price] of PRICE_DATA) {
      await client.query(
        `INSERT INTO price_references
           (category, item_type, min_price, median_price, max_price, source, last_updated)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (category, item_type)
         DO UPDATE SET
           min_price    = EXCLUDED.min_price,
           median_price = EXCLUDED.median_price,
           max_price    = EXCLUDED.max_price,
           source       = EXCLUDED.source,
           last_updated = NOW()`,
        [category, item_type, min_price, median_price, max_price, SOURCE]
      );
    }

    await client.query('COMMIT');
    console.log('Price reference seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
