const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');

function getConfig() {
  const sandbox = process.env.PAYFAST_SANDBOX !== 'false';
  return {
    PAYFAST_HOST: sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za',
    PF: {
      merchant_id:  process.env.PAYFAST_MERCHANT_ID || '10000100',
      merchant_key: process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a',
      passphrase:   process.env.PAYFAST_PASSPHRASE ?? '',
    },
    BACKEND_URL:  process.env.BACKEND_URL  || 'https://swapify-backend.azurewebsites.net',
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://swapify-frontend-b2h7gvfhhgaka6d7.austriaeast-01.azurewebsites.net',
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

router.post('/initiate', async (req, res) => {
  try {
    const { PAYFAST_HOST, PF, BACKEND_URL, FRONTEND_URL } = getConfig();
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
    return res.status(500).json({ error: 'Failed to initiate payment', message: err.message });
  }
});

router.post('/notify', express.urlencoded({ extended: false }), async (req, res) => {
  console.log('[PayFast ITN]', req.body);
  return res.sendStatus(200);
});

module.exports = router;
