// Run once to set up the database tables: node db/migrate.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('./index');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       TEXT UNIQUE NOT NULL,
      password    TEXT,                   -- null for Google-only accounts
      display_name TEXT NOT NULL DEFAULT 'Spofity User',
      avatar_url  TEXT,
      google_id   TEXT UNIQUE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✅ Tables created');
  await pool.end();
}

migrate().catch((e) => { console.error(e); process.exit(1); });
