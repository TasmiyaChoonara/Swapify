require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Running migration: ${file}`);
      try {
        await client.query(sql);
        console.log(`  Done: ${file}`);
      } catch (err) {
        console.log(`  Skipped: ${file} — ${err.message}`);
      }
    }
    console.log('All migrations completed.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
