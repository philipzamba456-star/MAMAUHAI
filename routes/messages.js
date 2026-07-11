const express = require('express');
const { pool } = require('../db/database');
const { authRequired } = require('../middleware/auth');

module.exports = (io) => {
  const router = express.Router();

  router.get('/conversations', authRequired, async (req, res) => {
    const id = req.user.id;
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.role,
              (SELECT body FROM messages WHERE (sender_id = u.id AND recipient_id = $1) OR (sender_id = $1 AND recipient_id = u.id) ORDER BY created_at DESC LIMIT 1) AS last_message,
              (SELECT created_at FROM messages WHERE (sender_id = u.id AND recipient_id = $1) OR (sender_id = $1 AND recipient_id = u.id) ORDER BY created_at DESC LIMIT 1) AS last_at,
              (SELECT COUNT(*)::int FROM messages WHERE sender_id = u.id AND recipient_id = $1 AND read_at IS NULL) AS unread
       FROM users u
       WHERE u.id != $1 AND u.id IN (
         SELECT sender_id FROM messages WHERE recipient_id = $1
         UNION
         SELECT recipient_id FROM messages WHERE sender_id = $1
       )
       ORDER BY last_at DESC`,
      [id]
    );
    res.json(rows);
  });

  router.get('/thread/:userId', authRequired, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM messages WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1) ORDER BY created_at ASC`,
      [req.user.id, req.params.userId]
    );

    await pool.query(
      `UPDATE messages SET read_at = now() WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL`,
      [req.params.userId, req.user.id]
    );

    res.json(rows);
  });

  router.post('/', authRequired, async (req, res) => {
    const { recipient_id, body } = req.body;
    if (!recipient_id || !body) return res.status(400).json({ error: 'recipient_id and body are required.' });

    const { rows } = await pool.query(
      'INSERT INTO messages (sender_id, recipient_id, body) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, recipient_id, body]
    );
    const message = rows[0];
    io.to(`user:${recipient_id}`).emit('message:new', message);
    res.status(201).json(message);
  });

  return router;
};
