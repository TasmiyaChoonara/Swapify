require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const pool = require('./config/db');
const messageModel = require('./models/messageModel');

const usersRouter = require('./routes/users');
const listingsRouter = require('./routes/listings');
const pricesRouter = require('./routes/prices');
const slotsRoutes = require("./routes/slots");
const bookingsRoutes = require("./routes/bookings");
const facilityConfigRouter = require('./routes/facilityConfig');
const paymentsRouter = require('./routes/payments');
const payfastRouter = require('./routes/payfast');
const transactionsRouter = require('./routes/transactions');
const messageRoutes = require('./routes/messageRoutes');
const threadRoutes = require('./routes/threadRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ratingsRouter = require('./routes/ratings');
const notificationsRouter = require('./routes/notifications');
const savedRouter = require('./routes/saved');

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5174',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.azurestaticapps\.net$/.test(origin)) return true;
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// API routes
app.use('/api/users', usersRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/prices', pricesRouter);
app.use("/api/slots", slotsRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use('/api/facility-config', facilityConfigRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/payfast', payfastRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/messages', messageRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ratings', ratingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/saved', savedRouter);

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('API is running...');
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('/{*path}', (req, res) => {
    // Never serve frontend for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// HTTP server + Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  // Client sends { threadId, userId } — userId is stored server-side and never
  // re-trusted from subsequent events, preventing sender identity spoofing.
  socket.on('join_thread', ({ threadId, userId }) => {
    socket.join(threadId);
    socket.data.userId = userId;
  });

  socket.on('send_message', async ({ threadId, content }) => {
    const senderId = socket.data.userId;
    if (!senderId) return;
    try {
      const message = await messageModel.createMessage(threadId, senderId, content);
      io.to(threadId).emit('new_message', message);
    } catch (err) {
      console.error('[Socket] send_message error:', err);
    }
  });

  socket.on('typing_start', ({ threadId }) => {
    socket.to(threadId).emit('user_typing');
  });

  socket.on('typing_stop', ({ threadId }) => {
    socket.to(threadId).emit('user_stopped_typing');
  });

  socket.on('disconnect', () => {});
});

async function start() {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  try {
    await pool.query('SELECT 1');
    console.log('Database connected');
  } catch (err) {
    console.error('Database connection warning:', err.message);
  }
}

start();
