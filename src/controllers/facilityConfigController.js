const facilityConfigService = require('../services/facilityConfigService');

async function getConfig(req, res) {
  try {
    const config = await facilityConfigService.getAllConfig();
    res.json(config);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function updateDayConfig(req, res) {
  try {
    const { dayOfWeek, openTime, closeTime, slotCapacity } = req.body;
    const updatedBy = req.user.id;
    const updated = await facilityConfigService.updateDayConfig({
      dayOfWeek, openTime, closeTime, slotCapacity, updatedBy,
    });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { getConfig, updateDayConfig };
