const analyticsModel = require('../models/analyticsModel');

const getAnalytics = async (req, res) => {
  try {
    const data = await analyticsModel.getAnalytics();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const exportAnalyticsCSV = async (req, res) => {
  try {
    const csv = await analyticsModel.getAnalyticsCSV();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="swapify-analytics-${date}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAnalytics, exportAnalyticsCSV };
