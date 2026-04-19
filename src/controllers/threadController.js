const threadModel = require('../models/threadModel');

const createThread = async (req, res) => {
  try {
    const { listingId, buyerId, sellerId } = req.body;
    const thread = await threadModel.getOrCreateThread(listingId, buyerId, sellerId);
    res.json(thread);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createThread };