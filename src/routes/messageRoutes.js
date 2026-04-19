const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/messageController');

router.get('/:threadId', getMessages);
router.post('/', sendMessage);

module.exports = router;