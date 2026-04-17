const facilityConfigModel = require('../models/facilityConfig');

const VALID_DAYS = [0, 1, 2, 3, 4, 5, 6];

function validate({ dayOfWeek, openTime, closeTime, slotCapacity }) {
  if (!VALID_DAYS.includes(Number(dayOfWeek))) {
    return { error: 'dayOfWeek must be an integer between 0 (Sunday) and 6 (Saturday)' };
  }
  const timeRe = /^\d{2}:\d{2}(:\d{2})?$/;
  if (!timeRe.test(openTime) || !timeRe.test(closeTime)) {
    return { error: 'openTime and closeTime must be in HH:MM or HH:MM:SS format' };
  }
  if (openTime >= closeTime) {
    return { error: 'openTime must be before closeTime' };
  }
  const capacity = Number(slotCapacity);
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { error: 'slotCapacity must be a positive integer' };
  }
  return { dayOfWeek: Number(dayOfWeek), openTime, closeTime, slotCapacity: capacity };
}

async function getAllConfig() {
  return facilityConfigModel.findAll();
}

async function updateDayConfig({ dayOfWeek, openTime, closeTime, slotCapacity, updatedBy }) {
  const validated = validate({ dayOfWeek, openTime, closeTime, slotCapacity });
  if (validated.error) {
    const err = new Error(validated.error);
    err.status = 400;
    throw err;
  }
  return facilityConfigModel.upsertByDay({ ...validated, updatedBy });
}

module.exports = { getAllConfig, updateDayConfig, validate };
