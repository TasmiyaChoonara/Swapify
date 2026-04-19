const paymentModel = require('../models/payment');
const pool = require('../config/db');
const crypto = require('crypto');

function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

function generateSignature(data, passphrase = '') {
  let str = Object.entries(data)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`)
    .join('&');
  if (passphrase) str += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

async function initiatePayment({ transactionId, totalPrice, listingId, itemName = 'Swapify Listing', nameFirst = '', nameLast = '', email = '' }) {
  const sandbox     = process.env.PAYFAST_SANDBOX !== 'false';
  const PAYFAST_HOST = sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
  const PF = {
    merchant_id:  requireEnv('PAYFAST_MERCHANT_ID'),
    merchant_key: requireEnv('PAYFAST_MERCHANT_KEY'),
    passphrase:   process.env.PAYFAST_PASSPHRASE ?? '',
  };
  const BACKEND_URL  = requireEnv('BACKEND_URL');
  const FRONTEND_URL = requireEnv('FRONTEND_URL');

  const total = Number(totalPrice);
  if (isNaN(total) || total <= 0) {
    const err = new Error('totalPrice must be a positive number');
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query('SELECT id FROM transactions WHERE id = $1', [transactionId]);
  if (!rows.length) {
    const err = new Error('Transaction not found');
    err.status = 404;
    throw err;
  }

  const payment = await paymentModel.create({ transactionId, amount: total, onlineAmount: total, cashShortfall: 0 });
  const m_payment_id = `swapify-${listingId}-${payment.id}`;

  const paymentData = {
    merchant_id:      PF.merchant_id,
    merchant_key:     PF.merchant_key,
    return_url:       `${FRONTEND_URL}/listings/${listingId}?payfast=success`,
    cancel_url:       `${FRONTEND_URL}/listings/${listingId}?payfast=cancel`,
    notify_url:       `${BACKEND_URL}/api/payfast/notify`,
    name_first:       nameFirst,
    name_last:        nameLast,
    email_address:    email,
    m_payment_id,
    amount:           total.toFixed(2),
    item_name:        itemName,
  };

  const clean = Object.fromEntries(Object.entries(paymentData).filter(([, v]) => v !== ''));
  const signature = generateSignature(clean, PF.passphrase);

  return {
    paymentId: payment.id,
    payfastUrl: `https://${PAYFAST_HOST}/eng/process`,
    paymentData: { ...clean, signature },
  };
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

module.exports = { initiatePayment, getPaymentByTransaction };
