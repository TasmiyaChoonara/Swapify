const { Router } = require('express');
const { suggest, categories } = require('../controllers/priceController');

const router = Router();

// Public — no auth needed; this is read-only reference data
router.get('/suggest',    suggest);
router.get('/categories', categories);

module.exports = router;
