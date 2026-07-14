const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/database');
const { JWT_SECRET, authRequired } = require('../middleware/auth');

module.exports = (io) => {
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, specialty } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required.' });
    }
    // Admin accounts can only be created by an existing administrator
    // (POST /api/users), never through public self-registration.
    if (!['mother', 'doctor', 'health_worker'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'An account with that email already exists.' });

    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, specialty)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, email, role, specialty, status`,
      [name, email, hash, role, specialty || null]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong registering the account.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    if (user.status !== 'active') return res.status(403).json({ error: `Account is ${user.status}. Contact an administrator.` });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    delete user.password_hash;
    res.json({ token, user, mustChangePassword: user.must_change_password });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong logging in.' });
  }
});

const { authRequired } = require('../middleware/auth');

router.post('/change-password', authRequired, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const valid = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    const newHash = bcrypt.hashSync(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [newHash, req.user.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong changing your password.' });
  }
});

// A user who cannot log in requests a password reset. This does NOT reset
// anything by itself — it creates a pending request that an administrator
// must review and approve from the admin dashboard. This avoids ever
// emailing/SMS-ing a reset link (no email/SMS provider is configured for
// this app) while still giving locked-out users a path back in.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const result = await pool.query('SELECT id, name, email, role FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Always return the same success message whether or not the account
    // exists, so this endpoint can't be used to check which emails are
    // registered.
    const genericResponse = {
      success: true,
      message: 'If an account exists for that email, a request has been sent to an administrator. You will be able to sign in again once it is approved.',
    };

    if (!user) return res.json(genericResponse);

    // Avoid piling up duplicate pending requests for the same user.
    const existingPending = await pool.query(
      `SELECT id FROM password_reset_requests WHERE user_id = $1 AND status = 'pending'`,
      [user.id]
    );
    if (existingPending.rows.length) return res.json(genericResponse);

    await pool.query('INSERT INTO password_reset_requests (user_id) VALUES ($1)', [user.id]);

    const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`);
    for (const admin of admins.rows) {
      const notif = await pool.query(
        `INSERT INTO notifications (user_id, type, body) VALUES ($1,'password_reset',$2) RETURNING *`,
        [admin.id, `${user.name} (${user.email}) requested a password reset.`]
      );
      if (io) io.to(`user:${admin.id}`).emit('notification', notif.rows[0]);
    }

    res.json(genericResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong submitting your request.' });
  }
});

return router;
};
