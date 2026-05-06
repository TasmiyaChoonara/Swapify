require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const usersRouter = require('./routes/users');
const listingsRouter = require('./routes/listings');
const pricesRouter = require('./routes/prices');
const slotsRoutes = require('./routes/slots');
const bookingsRoutes = require('./routes/bookings');
const facilityConfigRouter = require('./routes/facilityConfig');
const paymentsRouter = require('./routes/payments');
const payfastRouter = require('./routes/payfast');
const transactionsRouter = require('./routes/transactions');
const messageRoutes = require('./routes/messageRoutes');
const threadRoutes = require('./routes/threadRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5174',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    if (/^https:\/\/[a-z0-9-]+\.azurestaticapps\.net$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/users', usersRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/slots', slotsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/facility-config', facilityConfigRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/payfast', payfastRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/messages', messageRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('Swapify API is running...');
});

module.exports = app;
