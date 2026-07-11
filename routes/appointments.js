const express = require('express');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

module.exports = (io) => {
  const router = express.Router();

  async function notify(userId, type, body) {
    const { rows } = await pool.query(
      'INSERT INTO notifications (user_id, type, body) VALUES ($1,$2,$3) RETURNING *',
      [userId, type, body]
    );
    io.to(`user:${userId}`).emit('notification', rows[0]);
  }

  router.get('/', authRequired, async (req, res) => {
    let result;
    if (req.user.role === 'mother') {
      result = await pool.query(
        `SELECT a.*, p.name AS provider_name FROM appointments a
         LEFT JOIN users p ON p.id = a.provider_id
         WHERE a.mother_id = $1 ORDER BY a.created_at DESC`,
        [req.user.id]
      );
    } else if (req.user.role === 'doctor' || req.user.role === 'health_worker') {
      result = await pool.query(
        `SELECT a.*, m.name AS mother_name FROM appointments a
         JOIN users m ON m.id = a.mother_id
         WHERE a.provider_id = $1 ORDER BY a.created_at DESC`,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `SELECT a.*, m.name AS mother_name, p.name AS provider_name FROM appointments a
         JOIN users m ON m.id = a.mother_id
         LEFT JOIN users p ON p.id = a.provider_id
         ORDER BY a.created_at DESC`
      );
    }
    res.json(result.rows);
  });

  router.post('/', authRequired, requireRole('mother'), async (req, res) => {
    const { reason, scheduled_for } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO appointments (mother_id, reason, scheduled_for) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, reason || null, scheduled_for || null]
    );
    const appt = rows[0];

    const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin'`);
    for (const a of admins.rows) {
      await notify(a.id, 'appointment', `${req.user.name} booked a new appointment.`);
    }
    io.emit('appointment:new', appt);

    res.status(201).json(appt);
  });

  router.patch('/:id/assign', authRequired, requireRole('admin'), async (req, res) => {
    const { provider_id } = req.body;
    const existing = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Appointment not found.' });
    const appt = existing.rows[0];

    const { rows } = await pool.query(
      `UPDATE appointments SET provider_id = $1, status = 'assigned', updated_at = now() WHERE id = $2 RETURNING *`,
      [provider_id, req.params.id]
    );
    const updated = rows[0];

    await notify(provider_id, 'appointment', 'You have been assigned a new appointment.');
    await notify(appt.mother_id, 'appointment', 'Your appointment has been assigned to a provider.');
    io.emit('appointment:update', updated);

    res.json(updated);
  });

  router.patch('/:id/status', authRequired, requireRole('admin', 'doctor', 'health_worker'), async (req, res) => {
    const { status } = req.body;
    const allowed = ['pending', 'approved', 'assigned', 'completed', 'cancelled', 'rescheduled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

    const existing = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Appointment not found.' });
    const appt = existing.rows[0];

    const { rows } = await pool.query(
      `UPDATE appointments SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    const updated = rows[0];

    await notify(appt.mother_id, 'appointment', `Your appointment status changed to "${status}".`);
    io.emit('appointment:update', updated);

    res.json(updated);
  });

  return router;
};
