const express = require('express');
const { pool } = require('../db/database');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.user.id]
  );
  res.json(rows);
});

router.patch('/:id/read', authRequired, async (req, res) => {
  await pool.query(`UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
  res.json({ success: true });
});

router.patch('/read-all', authRequired, async (req, res) => {
  await pool.query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [req.user.id]);
  res.json({ success: true });
});

module.exports = router;
