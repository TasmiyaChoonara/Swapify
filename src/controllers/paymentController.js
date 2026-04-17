const paymentService = require('../services/paymentService');

async function initiatePayment(req, res) {
  try {
    const { transactionId, totalPrice, onlineAmount } = req.body;
    const result = await paymentService.initiatePayment({ transactionId, totalPrice, onlineAmount, listingId: req.body.listingId });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function capturePayment(req, res) {
  try {
    const { paymentId, paypalOrderId } = req.body;
    const payment = await paymentService.capturePayment({ paymentId, paypalOrderId });
    res.json(payment);
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

module.exports = { initiatePayment, capturePayment, getByTransaction };
