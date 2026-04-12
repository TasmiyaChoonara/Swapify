const listingModel = require('../models/listing');

const VALID_TYPES      = ['sale', 'trade', 'both'];
const VALID_CONDITIONS = ['new', 'good', 'fair'];
const VALID_STATUSES   = ['active', 'sold', 'removed'];

function validate({ title, type, condition, status }) {
  if (title !== undefined && !title.trim()) {
    throw Object.assign(new Error('title is required'), { status: 400 });
  }
  if (type !== undefined && !VALID_TYPES.includes(type)) {
    throw Object.assign(new Error(`type must be one of: ${VALID_TYPES.join(', ')}`), { status: 400 });
  }
  if (condition !== undefined && !VALID_CONDITIONS.includes(condition)) {
    throw Object.assign(new Error(`condition must be one of: ${VALID_CONDITIONS.join(', ')}`), { status: 400 });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw Object.assign(new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`), { status: 400 });
  }
}

async function getListings(filters = {}) {
  const { category, type, condition } = filters;
  return listingModel.findAll({ category, type, condition });
}

async function getListing(id) {
  const listing = await listingModel.findById(id);
  if (!listing) {
    throw Object.assign(new Error('Listing not found'), { status: 404 });
  }
  return listing;
}

async function createListing(sellerId, data) {
  const { title, description, price, condition, type, category } = data;
  validate({ title, type, condition });

  if (!title) {
    throw Object.assign(new Error('title is required'), { status: 400 });
  }

  return listingModel.create({ sellerId, title, description, price, condition, type, category });
}

async function updateListing(id, requesterId, data) {
  const listing = await listingModel.findById(id);
  if (!listing) {
    throw Object.assign(new Error('Listing not found'), { status: 404 });
  }
  if (listing.seller_id !== requesterId) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  validate(data);
  return listingModel.update(id, data);
}

async function deleteListing(id, requesterId, requesterRole) {
  const listing = await listingModel.findById(id);
  if (!listing) {
    throw Object.assign(new Error('Listing not found'), { status: 404 });
  }
  if (requesterRole !== 'admin' && listing.seller_id !== requesterId) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  await listingModel.delete(id);
}

module.exports = { getListings, getListing, createListing, updateListing, deleteListing };
