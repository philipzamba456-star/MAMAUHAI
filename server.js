require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const { JWT_SECRET } = require('./middleware/auth');
const { init, pool } = require('./db/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const complaintRoutes = require('./routes/complaints');
const statsRoutes = require('./routes/stats');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Socket.io: authenticate the socket connection with the same JWT used for REST
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required.'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload;
    next();
  } catch (err) {
    next(new Error('Invalid token.'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.user.id}`);
  socket.on('disconnect', () => {});
});

// Routes (appointment + message routers need `io` for real-time emits)
app.use('/api/auth', authRoutes(io));
app.use('/api/users', userRoutes(io));
app.use('/api/appointments', require('./routes/appointments')(io));
app.use('/api/messages', require('./routes/messages')(io));
app.use('/api/rides', require('./routes/rides')(io));
app.use('/api/mama-ai', require('./routes/mama-ai')());
app.use('/api/health-logs', require('./routes/health-logs'));
app.use('/api/notifications', notificationRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/payments', require('./routes/payments')(io));
app.use('/api/reviews', require('./routes/reviews')(io));
app.use('/api/medical-records', require('./routes/medical-records')(io));

app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error: ' + err.message;
  }
  res.json({ status: 'ok', database: dbStatus, time: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;

init()
  .then(() => {
    server.listen(PORT, () => console.log(`Mama Uhai backend running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
