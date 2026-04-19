const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');
const auth = require('../middleware/auth');
const payment = require('../models/payment');

function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

function getConfig() {
  const sandbox = process.env.PAYFAST_SANDBOX !== 'false';
  return {
    PAYFAST_HOST: sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za',
    PF: {
      merchant_id:  requireEnv('PAYFAST_MERCHANT_ID'),
      merchant_key: requireEnv('PAYFAST_MERCHANT_KEY'),
      passphrase:   process.env.PAYFAST_PASSPHRASE ?? '',
    },
    BACKEND_URL:  requireEnv('BACKEND_URL'),
    FRONTEND_URL: requireEnv('FRONTEND_URL'),
  };
}

function generateSignature(data, passphrase = '') {
  let str = Object.entries(data)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`)
    .join('&');
  if (passphrase) str += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

function verifyITNSignature(data, passphrase = '') {
  const { signature, ...rest } = data;
  return generateSignature(rest, passphrase) === signature;
}

function validateWithPayFast(postData, payfastHost) {
  return new Promise((resolve, reject) => {
    const body = Object.entries(postData)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const req = https.request({
      hostname: payfastHost, port: 443,
      path: '/eng/query/validate', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d.trim()));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

router.post('/initiate', auth, async (req, res) => {
  try {
    const { PAYFAST_HOST, PF, BACKEND_URL, FRONTEND_URL } = getConfig();
    const { transactionId, listingId, amount, itemName, itemDescription = '', nameFirst = '', nameLast = '', email = '' } = req.body;
    if (!transactionId || !listingId || !amount || !itemName) return res.status(400).json({ error: 'transactionId, listingId, amount, itemName required' });

    const total = Number(amount);
    const record = await payment.create({ transactionId, amount: total, onlineAmount: total, cashShortfall: 0 });
    const m_payment_id = `swapify-${listingId}-${record.id}`;

    const paymentData = {
      merchant_id:      PF.merchant_id,
      merchant_key:     PF.merchant_key,
      return_url:       `${FRONTEND_URL}/payment/success?listing=${listingId}`,
      cancel_url:       `${FRONTEND_URL}/payment/cancel?listing=${listingId}`,
      notify_url:       `${BACKEND_URL}/api/payfast/notify`,
      name_first:       nameFirst,
      name_last:        nameLast,
      email_address:    email,
      m_payment_id,
      amount:           total.toFixed(2),
      item_name:        itemName,
      item_description: itemDescription,
    };

    const clean = Object.fromEntries(Object.entries(paymentData).filter(([, v]) => v !== ''));
    const signature = generateSignature(clean, PF.passphrase);

    return res.json({ payfastUrl: `https://${PAYFAST_HOST}/eng/process`, paymentData: { ...clean, signature } });
  } catch (err) {
    console.error('[PayFast] initiate error:', err);
    return res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

router.post('/notify', express.urlencoded({ extended: false }), async (req, res) => {
  let paymentId;
  try {
    const { PAYFAST_HOST, PF } = getConfig();
    const data = req.body;
    if (!verifyITNSignature(data, PF.passphrase)) return res.status(400).send('Signature mismatch');

    const valid = await validateWithPayFast(data, PAYFAST_HOST);
    if (valid !== 'VALID') return res.status(400).send('ITN invalid');

    const { payment_status, m_payment_id, pf_payment_id } = data;
    paymentId = m_payment_id?.split('-')[2];

    if (payment_status === 'COMPLETE' && paymentId) {
      await payment.markPaid(paymentId, pf_payment_id);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('[PayFast] ITN error:', err);
    if (paymentId) await payment.markFailed(paymentId).catch(() => {});
    return res.status(500).send('Error');
  }
});

module.exports = router;
