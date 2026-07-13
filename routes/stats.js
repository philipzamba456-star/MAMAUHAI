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
    rides: await count(`SELECT COUNT(*)::int AS c FROM rides WHERE status = 'requested'`),
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

router.get('/analytics', authRequired, requireRole('admin'), async (req, res) => {
  const usersByRole = await pool.query(
    `SELECT role, COUNT(*)::int AS count FROM users GROUP BY role`
  );

  const apptsByStatus = await pool.query(
    `SELECT status, COUNT(*)::int AS count FROM appointments GROUP BY status`
  );

  // Appointments booked per day, last 30 days
  const apptsByDay = await pool.query(`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COALESCE(COUNT(a.id), 0)::int AS count
    FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
    LEFT JOIN appointments a ON date_trunc('day', a.created_at) = d.day
    GROUP BY d.day
    ORDER BY d.day
  `);

  // Mother signups per week, last 8 weeks
  const growthByWeek = await pool.query(`
    SELECT to_char(w.week, 'YYYY-MM-DD') AS week, COALESCE(COUNT(u.id), 0)::int AS count
    FROM generate_series(date_trunc('week', CURRENT_DATE) - INTERVAL '7 weeks', date_trunc('week', CURRENT_DATE), INTERVAL '1 week') AS w(week)
    LEFT JOIN users u ON date_trunc('week', u.created_at) = w.week AND u.role = 'mother'
    GROUP BY w.week
    ORDER BY w.week
  `);

  res.json({
    users_by_role: usersByRole.rows,
    appointments_by_status: apptsByStatus.rows,
    appointments_by_day: apptsByDay.rows,
    mother_growth_by_week: growthByWeek.rows,
  });
});

module.exports = router;
