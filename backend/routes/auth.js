const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db/index');
const requireAuth = require('../middleware/auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, displayName: user.display_name, avatarUrl: user.avatar_url },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// ─── Register ─────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'email, password and displayName are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password, display_name) VALUES ($1, $2, $3) RETURNING *`,
      [email.toLowerCase(), hash, displayName]
    );
    const user = result.rows[0];
    res.status(201).json({ token: signToken(user), user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (e) {
    console.error('Register error:', e.message);
    res.status(500).json({ error: 'Registration failed', detail: e.message });
  }
});

// ─── Login ─────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user || !user.password) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({ token: signToken(user), user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Google OAuth ──────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let result = await pool.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleId, email]);
    let user = result.rows[0];

    if (!user) {
      const ins = await pool.query(
        `INSERT INTO users (email, display_name, avatar_url, google_id) VALUES ($1, $2, $3, $4) RETURNING *`,
        [email, name, picture, googleId]
      );
      user = ins.rows[0];
    } else if (!user.google_id) {
      // Link google_id to existing email account
      await pool.query('UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3', [googleId, picture, user.id]);
      user.google_id = googleId;
      user.avatar_url = picture;
    }

    res.json({ token: signToken(user), user: { id: user.id, email: user.email, displayName: user.display_name, avatarUrl: user.avatar_url } });
  } catch (e) {
    console.error('Google auth error:', e.message);
    res.status(401).json({ error: 'Google sign-in failed' });
  }
});

// ─── Get current user ──────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
