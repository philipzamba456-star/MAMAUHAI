const express = require('express');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, requireRole('mother'), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM health_logs WHERE mother_id = $1 ORDER BY logged_at DESC LIMIT 90',
    [req.user.id]
  );
  res.json(rows);
});

router.post('/', authRequired, requireRole('mother'), async (req, res) => {
  const { weight_kg, bp_systolic, bp_diastolic, blood_sugar, temperature_c, mood, symptoms, baby_movements, water_intake_ml } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO health_logs
      (mother_id, weight_kg, bp_systolic, bp_diastolic, blood_sugar, temperature_c, mood, symptoms, baby_movements, water_intake_ml)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      req.user.id,
      weight_kg || null,
      bp_systolic || null,
      bp_diastolic || null,
      blood_sugar || null,
      temperature_c || null,
      mood || null,
      symptoms || null,
      baby_movements || null,
      water_intake_ml || null,
    ]
  );

  res.status(201).json(rows[0]);
});

module.exports = router;
