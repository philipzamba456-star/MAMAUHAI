const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, specialty, status, due_date, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json(rows[0] || null);
});

router.patch('/me', authRequired, async (req, res) => {
  const { due_date } = req.body;
  const { rows } = await pool.query(
    'UPDATE users SET due_date = $1 WHERE id = $2 RETURNING id, name, email, role, specialty, status, due_date',
    [due_date || null, req.user.id]
  );
  res.json(rows[0]);
});

router.get('/', authRequired, requireRole('admin'), async (req, res) => {
  const { role, q } = req.query;
  let sql = 'SELECT id, name, email, role, specialty, status, created_at FROM users WHERE 1=1';
  const params = [];
  if (role) { params.push(role); sql += ` AND role = $${params.length}`; }
  if (q) { params.push(`%${q}%`); sql += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`; }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

router.get('/providers', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, role, specialty FROM users WHERE role IN ('doctor','health_worker') AND status = 'active'`
  );
  res.json(rows);
});

router.patch('/:id', authRequired, requireRole('admin'), async (req, res) => {
  const { role, status, name, specialty } = req.body;
  const existing = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'User not found.' });

  const { rows } = await pool.query(
    `UPDATE users SET role = COALESCE($1, role), status = COALESCE($2, status),
     name = COALESCE($3, name), specialty = COALESCE($4, specialty) WHERE id = $5
     RETURNING id, name, email, role, specialty, status`,
    [role, status, name, specialty, req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', authRequired, requireRole('admin'), async (req, res) => {
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Admin generates a temporary password for a user and forces them to change it
// at next login. The admin never sees or sets the user's real password directly.
router.post('/:id/reset-password', authRequired, requireRole('admin'), async (req, res) => {
  const existing = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'User not found.' });

  // Generate a readable temporary password, e.g. "swift-forest-4821"
  const words = ['swift', 'gentle', 'bright', 'quiet', 'brave', 'calm', 'sunny', 'golden'];
  const nouns = ['forest', 'river', 'meadow', 'harbor', 'valley', 'summit', 'garden', 'shore'];
  const tempPassword = `${words[crypto.randomInt(words.length)]}-${nouns[crypto.randomInt(nouns.length)]}-${crypto.randomInt(1000, 9999)}`;

  const hash = bcrypt.hashSync(tempPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2', [hash, req.params.id]);

  res.json({
    success: true,
    tempPassword,
    message: `Share this temporary password with ${existing.rows[0].name} directly (e.g. in person or by phone). They will be required to set a new password the next time they log in. This password will not be shown again.`,
  });
});

module.exports = router;
