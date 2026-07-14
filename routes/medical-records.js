const express = require('express');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

module.exports = (io) => {
  const router = express.Router();

  // A mother's own records
  router.get('/me', authRequired, requireRole('mother'), async (req, res) => {
    const { rows } = await pool.query(
      `SELECT r.*, p.name AS provider_name FROM medical_records r
       LEFT JOIN users p ON p.id = r.provider_id
       WHERE r.mother_id = $1 ORDER BY r.recorded_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  });

  // Providers/admins looking up a specific mother's records
  router.get('/mother/:motherId', authRequired, requireRole('doctor', 'health_worker', 'admin'), async (req, res) => {
    const { rows } = await pool.query(
      `SELECT r.*, p.name AS provider_name FROM medical_records r
       LEFT JOIN users p ON p.id = r.provider_id
       WHERE r.mother_id = $1 ORDER BY r.recorded_at DESC`,
      [req.params.motherId]
    );
    res.json(rows);
  });

  router.post('/', authRequired, requireRole('doctor', 'health_worker', 'admin'), async (req, res) => {
    const { mother_id, record_type, title, details, recorded_at } = req.body;
    const validTypes = ['antenatal_visit', 'lab_result', 'prescription', 'delivery_note', 'postpartum_checkup', 'vaccination'];
    if (!mother_id || !record_type || !title) {
      return res.status(400).json({ error: 'mother_id, record_type and title are required.' });
    }
    if (!validTypes.includes(record_type)) return res.status(400).json({ error: 'Invalid record_type.' });

    const { rows } = await pool.query(
      `INSERT INTO medical_records (mother_id, provider_id, record_type, title, details, recorded_at)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6, now())) RETURNING *`,
      [mother_id, req.user.id, record_type, title, details || null, recorded_at || null]
    );

    const notif = await pool.query(
      `INSERT INTO notifications (user_id, type, body) VALUES ($1,'medical_record',$2) RETURNING *`,
      [mother_id, `A new medical record was added: ${title}.`]
    );
    if (io) io.to(`user:${mother_id}`).emit('notification', notif.rows[0]);

    res.status(201).json(rows[0]);
  });

  return router;
};
