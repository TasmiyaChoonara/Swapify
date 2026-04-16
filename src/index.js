require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const usersRouter = require('./routes/users');
const listingsRouter = require('./routes/listings');
const pricesRouter = require('./routes/prices');
const facilityConfigRouter = require('./routes/facilityConfig');
const paymentsRouter = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5174',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({
  origin(origin, callback) {
    // Allow server-to-server requests (no origin) and exact matches.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    // Allow any Vercel deployment as a fallback when FRONTEND_URL is not set.
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/users', usersRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/facility-config', facilityConfigRouter);
app.use('/api/payments', paymentsRouter);

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('/{*path}', (req, res) => { res.sendFile(path.join(__dirname, '../frontend/dist/index.html')); });

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

async function start() {
  app.listen(PORT, () => {
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
