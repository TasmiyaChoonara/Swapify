const { Pool } = require('pg');

// Prefer DATABASE_URL (set in .env) over individual vars so both formats work.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'campusmarket',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'password123',
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
