const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { pool } = require('../db/database');
const { JWT_SECRET, authRequired } = require('../middleware/auth');

const SESSION_TTL_MS = 3 * 60 * 1000; // 3 minutes
const QR_PREFIX = 'mamauhai-login:';

module.exports = () => {
const router = express.Router();

// Called by a browser that is NOT signed in, to start a QR login attempt.
// Returns a one-time token plus a ready-to-render QR code (as inline SVG
// markup) encoding that token. No authentication required to call this —
// the token itself is the only thing that matters, and it's a random,
// single-use, short-lived secret.
router.post('/start', async (req, res) => {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await pool.query(
      `INSERT INTO qr_login_sessions (token, status, expires_at) VALUES ($1, 'pending', $2)`,
      [token, expiresAt]
    );
    const qrSvg = await QRCode.toString(QR_PREFIX + token, { type: 'svg', margin: 1, width: 240 });
    res.json({ token, qrSvg, expiresIn: SESSION_TTL_MS / 1000 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not start a QR login session.' });
  }
});

// Polled repeatedly by the waiting (not-signed-in) browser to find out
// whether the code has been scanned and approved yet.
router.get('/status/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query('SELECT * FROM qr_login_sessions WHERE token = $1', [token]);
    const session = result.rows[0];
    if (!session) return res.json({ status: 'expired' });

    if (session.status === 'pending' && new Date(session.expires_at) < new Date()) {
      await pool.query(`UPDATE qr_login_sessions SET status = 'expired' WHERE token = $1`, [token]);
      return res.json({ status: 'expired' });
    }

    if (session.status === 'pending') return res.json({ status: 'pending' });

    if (session.status === 'approved') {
      const userResult = await pool.query(
        'SELECT id, name, email, role, specialty, status, due_date, created_at, must_change_password FROM users WHERE id = $1',
        [session.user_id]
      );
      const user = userResult.rows[0];
      if (!user || user.status !== 'active') {
        await pool.query(`UPDATE qr_login_sessions SET status = 'expired' WHERE token = $1`, [token]);
        return res.json({ status: 'expired' });
      }
      // Mark it used immediately so this token can't hand out a second
      // session if the waiting browser happens to poll again.
      await pool.query(`UPDATE qr_login_sessions SET status = 'used' WHERE token = $1`, [token]);
      const jwtToken = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ status: 'approved', token: jwtToken, user, mustChangePassword: user.must_change_password });
    }

    // 'used' or anything else already consumed / invalid at this point
    return res.json({ status: 'expired' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not check the QR login session.' });
  }
});

// Called by an already-signed-in browser/device (the one that scanned the
// code with its camera) to approve the waiting session as themself.
router.post('/approve', authRequired, async (req, res) => {
  try {
    let { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing QR token.' });
    if (token.startsWith(QR_PREFIX)) token = token.slice(QR_PREFIX.length);

    const result = await pool.query('SELECT * FROM qr_login_sessions WHERE token = $1', [token]);
    const session = result.rows[0];
    if (!session || session.status !== 'pending' || new Date(session.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This QR code has expired. Please refresh it and try again.' });
    }

    const updated = await pool.query(
      `UPDATE qr_login_sessions SET status = 'approved', user_id = $1 WHERE token = $2 AND status = 'pending' RETURNING token`,
      [req.user.id, token]
    );
    if (!updated.rows.length) {
      return res.status(400).json({ error: 'This QR code was already used or has expired.' });
    }

    res.json({ success: true, message: 'Signed in on your other device.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not approve the QR login.' });
  }
});

return router;
};
