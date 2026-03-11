require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const pool = require('./db/index');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
});

app.use(cors());
app.use(express.json());

// Routes
const authRouter = require('./routes/auth');
const songsRouter = require('./routes/songs');
const { router: sessionRouter } = require('./routes/session');

app.use('/api/auth', authRouter);
app.use('/api/songs', songsRouter);
app.use('/api/session', sessionRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Socket.io
require('./services/socket')(io);

// Run DB migration with retries, then start server
async function runMigration(retries = 10, delay = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email       TEXT UNIQUE NOT NULL,
          password    TEXT,
          display_name TEXT NOT NULL DEFAULT 'Spofity User',
          avatar_url  TEXT,
          google_id   TEXT UNIQUE,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('✅ DB migration complete');
      return;
    } catch (e) {
      console.warn(`⏳ DB not ready (attempt ${i}/${retries}): ${e.message}`);
      if (i < retries) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('❌ Could not connect to DB after retries');
}

const PORT = process.env.PORT || 3000;

runMigration()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🎵 Spofity backend running on port ${PORT}`);
    });
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
