const express = require('express');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  if (req.user.role === 'admin') {
    const { rows } = await pool.query(
      `SELECT c.*, u.name AS user_name FROM complaints c JOIN users u ON u.id = c.user_id ORDER BY c.created_at DESC`
    );
    return res.json(rows);
  }
  const { rows } = await pool.query('SELECT * FROM complaints WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  res.json(rows);
});

router.post('/', authRequired, async (req, res) => {
  const { subject, body } = req.body;
  if (!subject) return res.status(400).json({ error: 'subject is required.' });
  const { rows } = await pool.query(
    'INSERT INTO complaints (user_id, subject, body) VALUES ($1,$2,$3) RETURNING *',
    [req.user.id, subject, body || null]
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id/status', authRequired, requireRole('admin'), async (req, res) => {
  const { status } = req.body;
  if (!['open', 'in_review', 'resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const { rows } = await pool.query('UPDATE complaints SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  res.json(rows[0]);
});

module.exports = router;
