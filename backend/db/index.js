const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // External Render URLs contain .render.com and need SSL; internal ones don't
  ssl: process.env.DATABASE_URL?.includes('.render.com') ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => console.error('DB pool error:', err.message));

module.exports = pool;
