const express = require('express');
const { pool } = require('../db/database');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Any signed-in user can see the hospital list — it's used to populate
// selection dropdowns for booking appointments and requesting rides.
router.get('/', authRequired, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM hospitals ORDER BY name ASC');
  res.json(rows);
});

module.exports = router;
