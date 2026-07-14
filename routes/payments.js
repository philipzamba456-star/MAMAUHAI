const express = require('express');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

module.exports = (io) => {
  const router = express.Router();

  // Mothers see their own payments; doctors/health workers see payments for
  // appointments assigned to them; admins see everything.
  router.get('/', authRequired, async (req, res) => {
    let sql, params;
    if (req.user.role === 'admin') {
      sql = `SELECT p.*, m.name AS mother_name FROM payments p JOIN users m ON m.id = p.mother_id ORDER BY p.created_at DESC LIMIT 200`;
      params = [];
    } else if (req.user.role === 'mother') {
      sql = `SELECT * FROM payments WHERE mother_id = $1 ORDER BY created_at DESC`;
      params = [req.user.id];
    } else {
      sql = `SELECT p.*, m.name AS mother_name FROM payments p
             JOIN appointments a ON a.id = p.appointment_id
             JOIN users m ON m.id = p.mother_id
             WHERE a.provider_id = $1 ORDER BY p.created_at DESC`;
      params = [req.user.id];
    }
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  });

  router.post('/', authRequired, async (req, res) => {
    const { appointment_id, amount, method, description } = req.body;
    if (!amount || !method) return res.status(400).json({ error: 'amount and method are required.' });
    if (!['mobile_money', 'cash', 'insurance', 'bank_transfer'].includes(method)) {
      return res.status(400).json({ error: 'Invalid payment method.' });
    }

    const motherId = req.user.role === 'mother' ? req.user.id : req.body.mother_id;
    if (!motherId) return res.status(400).json({ error: 'mother_id is required.' });

    const { rows } = await pool.query(
      `INSERT INTO payments (mother_id, appointment_id, amount, method, description, status)
       VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
      [motherId, appointment_id || null, amount, method, description || null]
    );

    const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`);
    for (const admin of admins.rows) {
      const notif = await pool.query(
        `INSERT INTO notifications (user_id, type, body) VALUES ($1,'payment',$2) RETURNING *`,
        [admin.id, `New payment of ${amount} UGX recorded (pending).`]
      );
      if (io) io.to(`user:${admin.id}`).emit('notification', notif.rows[0]);
    }

    res.status(201).json(rows[0]);
  });

  router.patch('/:id/status', authRequired, requireRole('admin'), async (req, res) => {
    const { status } = req.body;
    if (!['pending', 'completed', 'failed', 'refunded'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const { rows } = await pool.query('UPDATE payments SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Payment not found.' });

    const notif = await pool.query(
      `INSERT INTO notifications (user_id, type, body) VALUES ($1,'payment',$2) RETURNING *`,
      [rows[0].mother_id, `Your payment of ${rows[0].amount} UGX is now ${status}.`]
    );
    if (io) io.to(`user:${rows[0].mother_id}`).emit('notification', notif.rows[0]);

    res.json(rows[0]);
  });

  return router;
};
