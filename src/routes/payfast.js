const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');

const SANDBOX = process.env.PAYFAST_SANDBOX !== 'false';
const PAYFAST_HOST = SANDBOX ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';

const PF = {
  merchant_id:  process.env.PAYFAST_MERCHANT_ID  || '10000100',
  merchant_key: process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a',
  passphrase:   process.env.PAYFAST_PASSPHRASE   || '',
};

const BACKEND_URL  = process.env.BACKEND_URL  || 'https://swapify-backend.azurewebsites.net';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://swapify-frontend-b2h7gvfhhgaka6d7.austriaeast-01.azurewebsites.net';

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

function validateWithPayFast(postData) {
  return new Promise((resolve, reject) => {
    const body = Object.entries(postData)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const req = https.request({
      hostname: PAYFAST_HOST, port: 443,
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

router.post('/initiate', async (req, res) => {
  try {
    const { listingId, amount, itemName, itemDescription = '', nameFirst = '', nameLast = '', email = '' } = req.body;
    if (!listingId || !amount || !itemName) return res.status(400).json({ error: 'listingId, amount, itemName required' });

    const m_payment_id = `swapify-${listingId}-${Date.now()}`;

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
      amount:           Number(amount).toFixed(2),
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
  try {
    const data = req.body;
    if (!verifyITNSignature(data, PF.passphrase)) return res.status(400).send('Signature mismatch');

    const valid = await validateWithPayFast(data);
    if (valid !== 'VALID') return res.status(400).send('ITN invalid');

    const { payment_status, m_payment_id, pf_payment_id } = data;
    const listingId = m_payment_id?.split('-')[1];

    if (payment_status === 'COMPLETE') {
      console.log(`[PayFast] COMPLETE listing=${listingId} pf_id=${pf_payment_id}`);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('[PayFast] ITN error:', err);
    return res.status(500).send('Error');
  }
});

module.exports = router;
