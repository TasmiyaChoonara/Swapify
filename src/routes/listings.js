const { Router } = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const userService = require('../services/userService');
const {
  getListings,
  getListing,
  createListing,
  updateListing,
  deleteListing,
  addListingImage,
} = require('../controllers/listingController');

const router = Router();

async function attachDbUser(req, res, next) {
  try {
    req.user = await userService.getOrCreateUser(req.clerkUser);
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve user', message: err.message });
  }
}

const protect = [auth, attachDbUser];

// Public
router.get('/',    getListings);
router.get('/:id', getListing);

// Auth required
router.post('/',           ...protect, requireRole('student', 'staff', 'admin'), createListing);
router.post('/:id/images', ...protect, addListingImage);
router.put('/:id',         ...protect, updateListing);
router.delete('/:id',      ...protect, deleteListing);

module.exports = router;
