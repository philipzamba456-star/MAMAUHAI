const express = require('express');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

// Flat estimated fares by ride type. Real fare-metering (distance-based
// pricing, live driver quotes) would need a mapping/telemetry integration;
// this gives mothers an honest, immediate estimate before they confirm.
const FARE_ESTIMATES = {
  ambulance: 0,       // Emergency transport — heavily subsidized/free at point of use
  uber: 15000,
  safeboda: 6000,
};

const RIDE_TYPE_LABELS = {
  ambulance: 'Ambulance',
  uber: 'Uber',
  safeboda: 'SafeBoda',
};

module.exports = (io) => {
  const router = express.Router();

  router.get('/fare-estimates', authRequired, (req, res) => {
    res.json(FARE_ESTIMATES);
  });

  router.get('/', authRequired, async (req, res) => {
    if (req.user.role === 'admin') {
      const { rows } = await pool.query(
        `SELECT r.*, u.name AS mother_name, h.name AS hospital_name
         FROM rides r JOIN users u ON u.id = r.mother_id
         LEFT JOIN hospitals h ON h.id = r.hospital_id
         ORDER BY r.created_at DESC`
      );
      return res.json(rows);
    }
    const { rows } = await pool.query(
      `SELECT r.*, h.name AS hospital_name FROM rides r
       LEFT JOIN hospitals h ON h.id = r.hospital_id
       WHERE r.mother_id = $1 ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  });

  router.post('/', authRequired, requireRole('mother'), async (req, res) => {
    const { pickup, destination, ride_type, hospital_id, payment_method } = req.body;
    if (!pickup || !destination) return res.status(400).json({ error: 'pickup and destination are required.' });

    const rideType = ['ambulance', 'uber', 'safeboda'].includes(ride_type) ? ride_type : 'safeboda';
    const fare = FARE_ESTIMATES[rideType];

    // A real, live payment record is created alongside the ride so the fare
    // shows up immediately for both the mother and admins — not just a
    // number displayed in the UI. Ambulance rides have no fare, so no
    // payment record is created for them at all.
    let paymentId = null;
    if (fare > 0) {
      const method = ['mobile_money', 'cash', 'insurance', 'bank_transfer'].includes(payment_method) ? payment_method : 'mobile_money';
      const paymentResult = await pool.query(
        `INSERT INTO payments (mother_id, amount, method, description, status)
         VALUES ($1,$2,$3,$4,'pending') RETURNING *`,
        [req.user.id, fare, method, `${RIDE_TYPE_LABELS[rideType]} ride: ${pickup} → ${destination}`]
      );
      paymentId = paymentResult.rows[0].id;
    }

    const { rows } = await pool.query(
      `INSERT INTO rides (mother_id, pickup, destination, ride_type, hospital_id, fare, payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, pickup, destination, rideType, hospital_id || null, fare, paymentId]
    );
    const ride = rows[0];

    const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`);
    for (const a of admins.rows) {
      const { rows: notifRows } = await pool.query(
        'INSERT INTO notifications (user_id, type, body) VALUES ($1,$2,$3) RETURNING *',
        [a.id, 'ride', `${req.user.name} requested a ${RIDE_TYPE_LABELS[rideType]} from ${pickup} to ${destination}${fare > 0 ? ` (${fare.toLocaleString()} UGX)` : ''}.`]
      );
      io.to(`user:${a.id}`).emit('notification', notifRows[0]);
    }
    io.emit('ride:new', ride);

    res.status(201).json(ride);
  });

  router.patch('/:id/status', authRequired, requireRole('admin'), async (req, res) => {
    const { status } = req.body;
    if (!['requested', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const { rows } = await pool.query('UPDATE rides SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Ride not found.' });
    io.emit('ride:update', rows[0]);
    res.json(rows[0]);
  });

  return router;
};
