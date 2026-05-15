require('dotenv').config();
const pool = require('../src/config/db');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS saved_listings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, listing_id)
    );
  `);
  console.log('saved_listings table created');

  await pool.query(`
    ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days';
  `);
  console.log('expires_at column added to listings');

  await pool.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
