const express = require('express');
const router = express.Router();

// In-memory session store (persists while server is alive)
const sessions = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Create a new group session (Jam)
router.post('/create', (req, res) => {
  const { userId, displayName } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  let code;
  do { code = generateCode(); } while (sessions.has(code));

  const session = {
    code,
    hostId: userId,
    hostName: displayName || 'Host',
    members: [{ userId, displayName: displayName || 'Host', isHost: true }],
    currentSong: null,
    isPlaying: false,
    position: 0,
    queue: [],
    createdAt: Date.now(),
  };

  sessions.set(code, session);

  // Auto-delete after 24 hours
  setTimeout(() => sessions.delete(code), 24 * 60 * 60 * 1000);

  res.json({ code, session });
});

// Get session info
router.get('/:code', (req, res) => {
  const session = sessions.get(req.params.code.toUpperCase());
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
});

// End session
router.delete('/:code', (req, res) => {
  sessions.delete(req.params.code.toUpperCase());
  res.json({ success: true });
});

module.exports = { router, sessions };
