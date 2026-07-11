const express = require('express');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

async function count(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0].c;
}

router.get('/admin', authRequired, requireRole('admin'), async (req, res) => {
  res.json({
    total_mothers: await count(`SELECT COUNT(*)::int AS c FROM users WHERE role = 'mother'`),
    total_doctors: await count(`SELECT COUNT(*)::int AS c FROM users WHERE role = 'doctor'`),
    health_workers: await count(`SELECT COUNT(*)::int AS c FROM users WHERE role = 'health_worker'`),
    providers: await count(`SELECT COUNT(*)::int AS c FROM users WHERE role IN ('doctor','health_worker')`),
    appointments: await count(`SELECT COUNT(*)::int AS c FROM appointments`),
    pending_appts: await count(`SELECT COUNT(*)::int AS c FROM appointments WHERE status = 'pending'`),
    messages: await count(`SELECT COUNT(*)::int AS c FROM messages`),
    complaints: await count(`SELECT COUNT(*)::int AS c FROM complaints WHERE status != 'resolved'`),
  });
});

router.get('/doctor', authRequired, requireRole('doctor', 'health_worker'), async (req, res) => {
  const id = req.user.id;
  res.json({
    assigned_patients: await count(`SELECT COUNT(DISTINCT mother_id)::int AS c FROM appointments WHERE provider_id = $1`, [id]),
    pending_approvals: await count(`SELECT COUNT(*)::int AS c FROM appointments WHERE provider_id = $1 AND status = 'assigned'`, [id]),
    upcoming: await count(`SELECT COUNT(*)::int AS c FROM appointments WHERE provider_id = $1 AND status IN ('approved','assigned')`, [id]),
    completed: await count(`SELECT COUNT(*)::int AS c FROM appointments WHERE provider_id = $1 AND status = 'completed'`, [id]),
    unread_messages: await count(`SELECT COUNT(*)::int AS c FROM messages WHERE recipient_id = $1 AND read_at IS NULL`, [id]),
  });
});

router.get('/mother', authRequired, requireRole('mother'), async (req, res) => {
  const id = req.user.id;
  res.json({
    upcoming: await count(`SELECT COUNT(*)::int AS c FROM appointments WHERE mother_id = $1 AND status IN ('pending','approved','assigned')`, [id]),
    unread_messages: await count(`SELECT COUNT(*)::int AS c FROM messages WHERE recipient_id = $1 AND read_at IS NULL`, [id]),
  });
});

module.exports = router;
