const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

module.exports = (io) => {
const router = express.Router();

router.get('/me', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, specialty, status, due_date, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json(rows[0] || null);
});

router.patch('/me', authRequired, async (req, res) => {
  const { due_date } = req.body;
  const { rows } = await pool.query(
    'UPDATE users SET due_date = $1 WHERE id = $2 RETURNING id, name, email, role, specialty, status, due_date',
    [due_date || null, req.user.id]
  );
  res.json(rows[0]);
});

router.get('/', authRequired, requireRole('admin'), async (req, res) => {
  const { role, q } = req.query;
  let sql = 'SELECT id, name, email, role, specialty, status, created_at FROM users WHERE 1=1';
  const params = [];
  if (role) { params.push(role); sql += ` AND role = $${params.length}`; }
  if (q) { params.push(`%${q}%`); sql += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`; }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

router.get('/providers', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, role, specialty FROM users WHERE role IN ('doctor','health_worker') AND status = 'active'`
  );
  res.json(rows);
});

// Admin creates a new user account directly. Unlike /api/auth/register
// (self-serve, unused by this app's UI), this is admin-only and the new
// user is required to set their own password at first login rather than
// the admin choosing one for them.
router.post('/', authRequired, requireRole('admin'), async (req, res) => {
  const { name, email, role, specialty } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: 'name, email and role are required.' });
  if (!['mother', 'doctor', 'health_worker', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) return res.status(409).json({ error: 'An account with that email already exists.' });

  // Issue a random temp password immediately, same as reset-password, so no
  // one — including the admin — ever chooses or sees a real user password.
  const words = ['swift', 'gentle', 'bright', 'quiet', 'brave', 'calm', 'sunny', 'golden'];
  const nouns = ['forest', 'river', 'meadow', 'harbor', 'valley', 'summit', 'garden', 'shore'];
  const tempPassword = `${words[crypto.randomInt(words.length)]}-${nouns[crypto.randomInt(nouns.length)]}-${crypto.randomInt(1000, 9999)}`;
  const hash = bcrypt.hashSync(tempPassword, 10);

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, specialty, must_change_password)
     VALUES ($1,$2,$3,$4,$5,true)
     RETURNING id, name, email, role, specialty, status`,
    [name, email, hash, role, specialty || null]
  );

  res.status(201).json({
    user: result.rows[0],
    tempPassword,
    message: `Share this temporary password with ${name} directly. They will be required to set a new password at first login. This password will not be shown again.`,
  });
});

// Admin-only view of the app's demo/seed accounts, for setup and testing
// purposes. Never returns passwords — only the identity of each account so
// an admin can look one up and issue it a fresh temporary password via
// reset-password if needed.
router.get('/demo-accounts', authRequired, requireRole('admin'), async (req, res) => {
  const demoEmails = [
    'admin@mamauhai.app', 'deputy.admin@mamauhai.app',
    'doctor@mamauhai.app', 'nakato@mamauhai.app', 'drkatushabe@mamauhai.app', 'drnansubuga@mamauhai.app', 'drmugisha@mamauhai.app',
    'health@mamauhai.app', 'okello@mamauhai.app', 'hw.namuli@mamauhai.app', 'hw.byaruhanga@mamauhai.app', 'hw.kirabo@mamauhai.app',
    'mother@mamauhai.app', 'alice@mamauhai.app', 'brenda@mamauhai.app', 'mother.nakimuli@mamauhai.app', 'mother.auma@mamauhai.app',
  ];
  const { rows } = await pool.query(
    `SELECT id, name, email, role, specialty, status FROM users WHERE email = ANY($1) ORDER BY role, name`,
    [demoEmails]
  );
  res.json(rows);
});

router.patch('/:id', authRequired, requireRole('admin'), async (req, res) => {
  const { role, status, name, specialty } = req.body;
  const existing = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'User not found.' });

  const { rows } = await pool.query(
    `UPDATE users SET role = COALESCE($1, role), status = COALESCE($2, status),
     name = COALESCE($3, name), specialty = COALESCE($4, specialty) WHERE id = $5
     RETURNING id, name, email, role, specialty, status`,
    [role, status, name, specialty, req.params.id]
  );

  if (status && status !== existing.rows[0].status) {
    const statusMessage = {
      active: 'Your account has been reactivated.',
      locked: 'Your account has been locked. Contact an administrator for help.',
      suspended: 'Your account has been suspended. Contact an administrator for help.',
    }[status] || `Your account status changed to ${status}.`;
    const notif = await pool.query(
      `INSERT INTO notifications (user_id, type, body) VALUES ($1,'account_status',$2) RETURNING *`,
      [req.params.id, statusMessage]
    );
    if (io) io.to(`user:${req.params.id}`).emit('notification', notif.rows[0]);
  }

  res.json(rows[0]);
});

router.delete('/:id', authRequired, requireRole('admin'), async (req, res) => {
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Admin generates a temporary password for a user and forces them to change it
// at next login. The admin never sees or sets the user's real password directly.
async function issueTempPassword(userId) {
  const words = ['swift', 'gentle', 'bright', 'quiet', 'brave', 'calm', 'sunny', 'golden'];
  const nouns = ['forest', 'river', 'meadow', 'harbor', 'valley', 'summit', 'garden', 'shore'];
  const tempPassword = `${words[crypto.randomInt(words.length)]}-${nouns[crypto.randomInt(nouns.length)]}-${crypto.randomInt(1000, 9999)}`;
  const hash = bcrypt.hashSync(tempPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2', [hash, userId]);
  return tempPassword;
}

router.post('/:id/reset-password', authRequired, requireRole('admin'), async (req, res) => {
  const existing = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'User not found.' });

  const tempPassword = await issueTempPassword(req.params.id);

  res.json({
    success: true,
    tempPassword,
    message: `Share this temporary password with ${existing.rows[0].name} directly (e.g. in person or by phone). They will be required to set a new password the next time they log in. This password will not be shown again.`,
  });
});

// ------------------------- Password reset requests -------------------------
// Users submit these via POST /api/auth/forgot-password. Admins review and
// approve/deny them here. Approving reuses the same temp-password mechanism
// as a direct admin reset, so no plain-text password is ever stored.

router.get('/password-resets', authRequired, requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.status, r.requested_at, r.resolved_at, u.id AS user_id, u.name, u.email, u.role
     FROM password_reset_requests r
     JOIN users u ON u.id = r.user_id
     ORDER BY r.requested_at DESC LIMIT 100`
  );
  res.json(rows);
});

router.post('/password-resets/:id/approve', authRequired, requireRole('admin'), async (req, res) => {
  const existing = await pool.query(
    `SELECT r.*, u.name, u.email FROM password_reset_requests r JOIN users u ON u.id = r.user_id WHERE r.id = $1`,
    [req.params.id]
  );
  if (!existing.rows.length) return res.status(404).json({ error: 'Request not found.' });
  const request = existing.rows[0];
  if (request.status !== 'pending') return res.status(409).json({ error: `Request already ${request.status}.` });

  const tempPassword = await issueTempPassword(request.user_id);
  await pool.query(
    `UPDATE password_reset_requests SET status = 'approved', resolved_at = now(), resolved_by = $1 WHERE id = $2`,
    [req.user.id, req.params.id]
  );

  const notif = await pool.query(
    `INSERT INTO notifications (user_id, type, body) VALUES ($1,'password_reset','Your password reset was approved. Contact an administrator to receive your temporary password.') RETURNING *`,
    [request.user_id]
  );
  if (io) io.to(`user:${request.user_id}`).emit('notification', notif.rows[0]);

  res.json({
    success: true,
    tempPassword,
    message: `Share this temporary password with ${request.name} directly (e.g. in person or by phone). They will be required to set a new password at next login. This password will not be shown again.`,
  });
});

router.post('/password-resets/:id/deny', authRequired, requireRole('admin'), async (req, res) => {
  const existing = await pool.query('SELECT * FROM password_reset_requests WHERE id = $1', [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Request not found.' });
  if (existing.rows[0].status !== 'pending') return res.status(409).json({ error: `Request already ${existing.rows[0].status}.` });

  await pool.query(
    `UPDATE password_reset_requests SET status = 'denied', resolved_at = now(), resolved_by = $1 WHERE id = $2`,
    [req.user.id, req.params.id]
  );
  res.json({ success: true });
});

return router;
};
