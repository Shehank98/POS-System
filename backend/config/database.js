const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// Convenience wrapper so controllers can do: const { rows } = await db.query(...)
const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};

module.exports = db;
