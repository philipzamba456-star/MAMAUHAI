const express = require('express');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, specialty, status, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json(rows[0] || null);
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

module.exports = router;
