const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway internal network does NOT use SSL
  ssl: false,
});

pool.on('error', (err) => console.error('DB pool error:', err.message));

module.exports = pool;
