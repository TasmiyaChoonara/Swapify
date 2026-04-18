const { Pool } = require('pg');

if (process.env.NODE_ENV !== 'test' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required but not set');
}

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
}

module.exports = pool;
