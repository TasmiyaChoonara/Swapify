const listingService = require('../services/listingService');
const listingModel = require('../models/listing');

async function getListings(req, res) {
  try {
    const { category, type, condition } = req.query;
    const listings = await listingService.getListings({ category, type, condition });
    res.json(listings);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function getListing(req, res) {
  try {
    const listing = await listingService.getListing(req.params.id);
    res.json(listing);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

const createListing = async (req, res) => {
  try {
    const listing = await listingService.createListing(req.user.id, req.body);
    res.status(201).json(listing);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
async function updateListing(req, res) {
  try {
    const listing = await listingService.updateListing(req.params.id, req.user.id, req.body);
    res.json(listing);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function deleteListing(req, res) {
  try {
    await listingService.deleteListing(req.params.id, req.user.id, req.user.role);
    res.status(204).send();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function addListingImage(req, res) {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    // Ensure the listing exists and belongs to the requester
    const listing = await listingModel.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const image = await listingModel.addImage(req.params.id, imageUrl);
    res.status(201).json(image);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getListings, getListing, createListing, updateListing, deleteListing, addListingImage };
