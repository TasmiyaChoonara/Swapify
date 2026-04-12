require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const usersRouter = require('./routes/users');
const listingsRouter = require('./routes/listings');
const pricesRouter = require('./routes/prices');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/api/users', usersRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/prices', pricesRouter);

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('Database connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
}

start();
