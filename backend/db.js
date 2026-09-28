const { Pool, types } = require('pg');
require('dotenv').config();

// Return date columns as plain "YYYY-MM-DD" strings instead of JS Date objects
// to avoid timezone-shift issues in JSON serialization
types.setTypeParser(1082, val => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unerwarteter Datenbankfehler:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
