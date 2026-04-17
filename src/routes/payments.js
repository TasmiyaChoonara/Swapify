const { Router } = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const userService = require('../services/userService');
const { initiatePayment, getByTransaction } = require('../controllers/paymentController');

const router = Router();

async function attachDbUser(req, res, next) {
  try {
    req.user = await userService.getOrCreateUser(req.clerkUser);
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve user', message: err.message });
  }
}

router.use(auth, attachDbUser);

router.post('/initiate', initiatePayment);
router.get('/transaction/:transactionId', requireRole('staff', 'admin'), getByTransaction);

module.exports = router;
