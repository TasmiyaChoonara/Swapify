const paymentModel = require('../models/payment');
const paypalService = require('./paypalService');
const pool = require('../config/db');

async function initiatePayment({ transactionId, totalPrice, onlineAmount, listingId }) {
  const total = Number(totalPrice);
  const online = Number(onlineAmount);

  if (isNaN(total) || total <= 0) {
    const err = new Error('totalPrice must be a positive number');
    err.status = 400;
    throw err;
  }
  if (isNaN(online) || online < 0) {
    const err = new Error('onlineAmount must be zero or a positive number');
    err.status = 400;
    throw err;
  }
  if (online > total) {
    const err = new Error('onlineAmount cannot exceed totalPrice');
    err.status = 400;
    throw err;
  }

  const cashShortfall = +(total - online).toFixed(2);

  const { rows } = await pool.query('SELECT id FROM transactions WHERE id = $1', [transactionId]);
  if (!rows.length) {
    const err = new Error('Transaction not found');
    err.status = 404;
    throw err;
  }

  const payment = await paymentModel.create({ transactionId, amount: total, onlineAmount: online, cashShortfall });

  let paypalOrderId = null;
  let approvalUrl = null;

  if (online > 0) {
    const order = await paypalService.createOrder(online, 'USD', listingId ? `/listings/${listingId}` : '');
    paypalOrderId = order.id;
    approvalUrl = order.links.find((l) => l.rel === 'approve')?.href || null;
  }

  return { paymentId: payment.id, paypalOrderId, approvalUrl, cashShortfall };
}

async function capturePayment({ paymentId, paypalOrderId }) {
  const payment = await paymentModel.findById(paymentId);
  if (!payment) {
    const err = new Error('Payment not found');
    err.status = 404;
    throw err;
  }

  if (payment.status === 'paid') return payment;

  const capture = await paypalService.captureOrder(paypalOrderId);

  if (capture.status !== 'COMPLETED') {
    await paymentModel.markFailed(paymentId);
    const err = new Error(`PayPal capture not completed. Status: ${capture.status}`);
    err.status = 402;
    throw err;
  }

  return paymentModel.markPaid(paymentId, paypalOrderId);
}

async function getPaymentByTransaction(transactionId) {
  const payment = await paymentModel.findByTransactionId(transactionId);
  if (!payment) {
    const err = new Error('Payment not found for this transaction');
    err.status = 404;
    throw err;
  }
  return payment;
}

module.exports = { initiatePayment, capturePayment, getPaymentByTransaction };
