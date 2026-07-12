const express = require('express');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

module.exports = (io) => {
  const router = express.Router();

  router.get('/', authRequired, async (req, res) => {
    if (req.user.role === 'admin') {
      const { rows } = await pool.query(
        `SELECT r.*, u.name AS mother_name FROM rides r JOIN users u ON u.id = r.mother_id ORDER BY r.created_at DESC`
      );
      return res.json(rows);
    }
    const { rows } = await pool.query('SELECT * FROM rides WHERE mother_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(rows);
  });

  router.post('/', authRequired, requireRole('mother'), async (req, res) => {
    const { pickup, destination } = req.body;
    if (!pickup || !destination) return res.status(400).json({ error: 'pickup and destination are required.' });

    const { rows } = await pool.query(
      'INSERT INTO rides (mother_id, pickup, destination) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, pickup, destination]
    );
    const ride = rows[0];

    const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin'`);
    for (const a of admins.rows) {
      const { rows: notifRows } = await pool.query(
        'INSERT INTO notifications (user_id, type, body) VALUES ($1,$2,$3) RETURNING *',
        [a.id, 'ride', `${req.user.name} requested a ride from ${pickup} to ${destination}.`]
      );
      io.to(`user:${a.id}`).emit('notification', notifRows[0]);
    }

    res.status(201).json(ride);
  });

  router.patch('/:id/status', authRequired, requireRole('admin'), async (req, res) => {
    const { status } = req.body;
    if (!['requested', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const { rows } = await pool.query('UPDATE rides SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    res.json(rows[0]);
  });

  return router;
};
