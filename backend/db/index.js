const { Pool } = require('pg');

const isRender = process.env.RENDER || process.env.DATABASE_URL?.includes('render.com');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRender ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => console.error('DB pool error:', err.message));

module.exports = pool;
