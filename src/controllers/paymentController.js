const paymentService = require('../services/paymentService');

async function initiatePayment(req, res) {
  try {
    const { transactionId, totalPrice, listingId, itemName, nameFirst, nameLast, email } = req.body;
    const result = await paymentService.initiatePayment({ transactionId, totalPrice, listingId, itemName, nameFirst, nameLast, email });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function getByTransaction(req, res) {
  try {
    const payment = await paymentService.getPaymentByTransaction(req.params.transactionId);
    res.json(payment);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { initiatePayment, getByTransaction };
