const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userService = require('../services/userService');
const { getMessages, sendMessage } = require('../controllers/messageController');

async function attachDbUser(req, res, next) {
  try {
    req.user = await userService.getOrCreateUser(req.clerkUser);
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve user', message: err.message });
  }
}

router.get('/:threadId', auth, attachDbUser, getMessages);
router.post('/', auth, attachDbUser, sendMessage);

module.exports = router;