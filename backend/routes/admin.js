const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db/index');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

function requireAdmin(req, res, next) {
  // Option 1: x-admin-secret header (for external tools / scripts)
  const secret = req.headers['x-admin-secret'];
  if (secret && secret === process.env.ADMIN_SECRET) return next();

  // Option 2: JWT Bearer token from an admin email (for in-app admin panel)
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
      if (decoded.email && ADMIN_EMAILS.includes(decoded.email.toLowerCase())) {
        return next();
      }
    } catch (_) {}
  }

  return res.status(403).json({ error: 'Forbidden' });
}

// GET /api/admin/users — all users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.avatar_url,
        u.approved,
        u.google_id IS NOT NULL AS has_google,
        u.created_at,
        COUNT(DISTINCT d.id) AS device_count,
        COUNT(DISTINCT l.id) AS login_count,
        MAX(l.logged_in_at) AS last_login
      FROM users u
      LEFT JOIN devices d ON d.user_id = u.id
      LEFT JOIN login_logs l ON l.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json({ users: users.rows });
  } catch (e) {
    console.error('Admin users error:', e.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/pending — users waiting for approval
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.email, u.display_name, u.avatar_url, u.created_at,
        u.google_id IS NOT NULL AS has_google,
        d.device_name, d.os, d.app_version, d.first_seen
      FROM users u
      LEFT JOIN devices d ON d.user_id = u.id
      WHERE u.approved = false
      ORDER BY u.created_at DESC
    `);
    res.json({ pending: result.rows });
  } catch (e) {
    console.error('Admin pending error:', e.message);
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
});

// POST /api/admin/users/:id/approve
router.post('/users/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE users SET approved = true WHERE id = $1 RETURNING id, email, display_name`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ approved: true, user: result.rows[0] });
  } catch (e) {
    console.error('Admin approve error:', e.message);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// POST /api/admin/users/:id/reject — deletes the user entirely
router.post('/users/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING email`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ rejected: true, email: result.rows[0].email });
  } catch (e) {
    console.error('Admin reject error:', e.message);
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

// GET /api/admin/users/:id — single user detail
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [userRes, devicesRes, logsRes] = await Promise.all([
      pool.query('SELECT id, email, display_name, avatar_url, approved, created_at FROM users WHERE id = $1', [id]),
      pool.query('SELECT * FROM devices WHERE user_id = $1 ORDER BY last_seen DESC', [id]),
      pool.query('SELECT * FROM login_logs WHERE user_id = $1 ORDER BY logged_in_at DESC LIMIT 50', [id]),
    ]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: userRes.rows[0], devices: devicesRes.rows, loginHistory: logsRes.rows });
  } catch (e) {
    console.error('Admin user detail error:', e.message);
    res.status(500).json({ error: 'Failed to fetch user detail' });
  }
});

// GET /api/admin/logins — recent login logs
router.get('/logins', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const logs = await pool.query(`
      SELECT l.*, u.display_name
      FROM login_logs l
      JOIN users u ON u.id = l.user_id
      ORDER BY l.logged_in_at DESC
      LIMIT $1
    `, [limit]);
    res.json({ logs: logs.rows });
  } catch (e) {
    console.error('Admin logins error:', e.message);
    res.status(500).json({ error: 'Failed to fetch login logs' });
  }
});

module.exports = router;
