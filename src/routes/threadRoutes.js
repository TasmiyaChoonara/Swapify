const express = require('express');
const router = express.Router();
const { createThread } = require('../controllers/threadController');

router.post('/', createThread);

module.exports = router;