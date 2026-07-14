const express = require('express');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

module.exports = (io) => {
  const router = express.Router();

  router.get('/provider/:providerId', authRequired, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT r.*, m.name AS mother_name FROM reviews r JOIN users m ON m.id = r.mother_id
       WHERE r.provider_id = $1 ORDER BY r.created_at DESC`,
      [req.params.providerId]
    );
    const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
    res.json({ reviews: rows, average_rating: avg, count: rows.length });
  });

  router.get('/', authRequired, async (req, res) => {
    let sql, params;
    if (req.user.role === 'admin') {
      sql = `SELECT r.*, m.name AS mother_name, p.name AS provider_name FROM reviews r
             JOIN users m ON m.id = r.mother_id JOIN users p ON p.id = r.provider_id
             ORDER BY r.created_at DESC LIMIT 200`;
      params = [];
    } else if (req.user.role === 'mother') {
      sql = `SELECT r.*, p.name AS provider_name FROM reviews r JOIN users p ON p.id = r.provider_id
             WHERE r.mother_id = $1 ORDER BY r.created_at DESC`;
      params = [req.user.id];
    } else {
      sql = `SELECT r.*, m.name AS mother_name FROM reviews r JOIN users m ON m.id = r.mother_id
             WHERE r.provider_id = $1 ORDER BY r.created_at DESC`;
      params = [req.user.id];
    }
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  });

  router.post('/', authRequired, requireRole('mother'), async (req, res) => {
    const { provider_id, appointment_id, rating, comment } = req.body;
    if (!provider_id || !rating) return res.status(400).json({ error: 'provider_id and rating are required.' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be between 1 and 5.' });

    const { rows } = await pool.query(
      `INSERT INTO reviews (mother_id, provider_id, appointment_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, provider_id, appointment_id || null, rating, comment || null]
    );

    const notif = await pool.query(
      `INSERT INTO notifications (user_id, type, body) VALUES ($1,'review',$2) RETURNING *`,
      [provider_id, `${req.user.name} left you a ${rating}-star review.`]
    );
    if (io) io.to(`user:${provider_id}`).emit('notification', notif.rows[0]);

    res.status(201).json(rows[0]);
  });

  return router;
};
