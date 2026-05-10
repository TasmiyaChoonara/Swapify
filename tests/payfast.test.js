'use strict';

jest.mock('../src/models/payment');
jest.mock('https');
jest.mock('../src/services/userService', () => ({
  getOrCreateUser: jest.fn().mockResolvedValue({ id: 'db-user-1', role: 'student' }),
}));

const { EventEmitter } = require('events');
const https = require('https');
const crypto = require('crypto');
const payment = require('../src/models/payment');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/expressApp');

beforeAll(() => {
  process.env.PAYFAST_MERCHANT_ID  = '10000100';
  process.env.PAYFAST_MERCHANT_KEY = '46f0cd694581a';
  process.env.PAYFAST_PASSPHRASE   = 'testpassphrase';
  process.env.BACKEND_URL          = 'http://localhost:3000';
  process.env.FRONTEND_URL         = 'http://localhost:5173';
  process.env.PAYFAST_SANDBOX      = 'true';
});

beforeEach(() => jest.clearAllMocks());

function makeToken(sub) {
  return 'Bearer ' + jwt.sign({ sub }, 'test-secret');
}

const STUDENT_TOKEN = makeToken('student-clerk-1');

// Replicates generateSignature from payfast.js so tests can build valid payloads
function buildSignature(data, passphrase) {
  const str = Object.entries(data)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`)
    .join('&');
  const full = passphrase
    ? `${str}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
    : str;
  return crypto.createHash('md5').update(full).digest('hex');
}

function mockHttpsRequest(responseText) {
  const fakeReq = { write: jest.fn(), end: jest.fn(), on: jest.fn() };
  https.request.mockImplementation((opts, callback) => {
    const fakeRes = new EventEmitter();
    setImmediate(() => {
      fakeRes.emit('data', responseText);
      fakeRes.emit('end');
    });
    callback(fakeRes);
    return fakeReq;
  });
}

// Builds a notify payload with a correct signature for PAYFAST_PASSPHRASE='testpassphrase'
function makeNotifyPayload(overrides = {}) {
  const base = {
    merchant_id:    '10000100',
    merchant_key:   '46f0cd694581a',
    m_payment_id:   'swapify-listing1-payid001',
    pf_payment_id:  'pf-001',
    payment_status: 'COMPLETE',
    amount_gross:   '150.00',
  };
  const data = { ...base, ...overrides };
  const signature = buildSignature(data, 'testpassphrase');
  return { ...data, signature };
}

// ─── POST /api/payfast/initiate ───────────────────────────────────────────────

describe('POST /api/payfast/initiate', () => {
  test('400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/payfast/initiate')
      .set('Authorization', STUDENT_TOKEN)
      .send({ amount: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('400 when transactionId only provided', async () => {
    const res = await request(app)
      .post('/api/payfast/initiate')
      .set('Authorization', STUDENT_TOKEN)
      .send({ transactionId: 'txn-1' });
    expect(res.status).toBe(400);
  });

  test('200 returns payfastUrl and paymentData with signature', async () => {
    payment.create.mockResolvedValue({ id: 'payid001', status: 'pending' });
    const res = await request(app)
      .post('/api/payfast/initiate')
      .set('Authorization', STUDENT_TOKEN)
      .send({
        transactionId: 'txn-1',
        listingId:     'listing1',
        amount:        150,
        itemName:      'Textbook',
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('payfastUrl');
    expect(res.body).toHaveProperty('paymentData');
    expect(res.body.paymentData).toHaveProperty('signature');
    expect(res.body.paymentData.amount).toBe('150.00');
  });

  test('payfastUrl uses sandbox host when PAYFAST_SANDBOX=true', async () => {
    payment.create.mockResolvedValue({ id: 'payid001' });
    const res = await request(app)
      .post('/api/payfast/initiate')
      .set('Authorization', STUDENT_TOKEN)
      .send({ transactionId: 'txn-1', listingId: 'listing1', amount: 200, itemName: 'Laptop' });
    expect(res.body.payfastUrl).toContain('sandbox.payfast.co.za');
  });

  test('paymentData contains correct merchant_id and item_name', async () => {
    payment.create.mockResolvedValue({ id: 'payid001' });
    const res = await request(app)
      .post('/api/payfast/initiate')
      .set('Authorization', STUDENT_TOKEN)
      .send({ transactionId: 'txn-1', listingId: 'listing1', amount: 99, itemName: 'Notes' });
    expect(res.body.paymentData.merchant_id).toBe('10000100');
    expect(res.body.paymentData.item_name).toBe('Notes');
  });

  test('401 when no Authorization header', async () => {
    const res = await request(app)
      .post('/api/payfast/initiate')
      .send({ transactionId: 'txn-1', listingId: 'l1', amount: 100, itemName: 'Book' });
    expect(res.status).toBe(401);
  });

  test('500 when payment.create throws', async () => {
    payment.create.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .post('/api/payfast/initiate')
      .set('Authorization', STUDENT_TOKEN)
      .send({ transactionId: 'txn-1', listingId: 'listing1', amount: 100, itemName: 'Book' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to initiate payment');
  });
});

// ─── POST /api/payfast/notify ─────────────────────────────────────────────────

describe('POST /api/payfast/notify', () => {
  test('400 on signature mismatch', async () => {
    const payload = makeNotifyPayload();
    payload.signature = 'bad-signature-value';
    const res = await request(app)
      .post('/api/payfast/notify')
      .type('form')
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.text).toBe('Signature mismatch');
  });

  test('400 when PayFast ITN validation returns INVALID', async () => {
    mockHttpsRequest('INVALID');
    const payload = makeNotifyPayload();
    const res = await request(app)
      .post('/api/payfast/notify')
      .type('form')
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.text).toBe('ITN invalid');
  });

  test('200 and marks payment paid on COMPLETE status', async () => {
    mockHttpsRequest('VALID');
    payment.markPaid.mockResolvedValue({ id: 'payid001', status: 'paid' });
    const payload = makeNotifyPayload();
    const res = await request(app)
      .post('/api/payfast/notify')
      .type('form')
      .send(payload);
    expect(res.status).toBe(200);
    expect(payment.markPaid).toHaveBeenCalledWith('payid001', 'pf-001');
  });

  test('200 and does NOT call markPaid for non-COMPLETE status', async () => {
    mockHttpsRequest('VALID');
    const payload = makeNotifyPayload({ payment_status: 'FAILED' });
    const res = await request(app)
      .post('/api/payfast/notify')
      .type('form')
      .send(payload);
    expect(res.status).toBe(200);
    expect(payment.markPaid).not.toHaveBeenCalled();
  });

  test('200 and does NOT call markPaid when m_payment_id is missing', async () => {
    mockHttpsRequest('VALID');
    // Build payload without m_payment_id
    const base = {
      merchant_id:    '10000100',
      merchant_key:   '46f0cd694581a',
      pf_payment_id:  'pf-001',
      payment_status: 'COMPLETE',
      amount_gross:   '150.00',
    };
    const signature = buildSignature(base, 'testpassphrase');
    const payload = { ...base, signature };
    const res = await request(app)
      .post('/api/payfast/notify')
      .type('form')
      .send(payload);
    expect(res.status).toBe(200);
    expect(payment.markPaid).not.toHaveBeenCalled();
  });

  test('500 and calls markFailed when markPaid throws', async () => {
    mockHttpsRequest('VALID');
    payment.markPaid.mockRejectedValue(new Error('DB error'));
    payment.markFailed.mockResolvedValue({ id: 'payid001', status: 'failed' });
    const payload = makeNotifyPayload();
    const res = await request(app)
      .post('/api/payfast/notify')
      .type('form')
      .send(payload);
    expect(res.status).toBe(500);
    expect(payment.markFailed).toHaveBeenCalled();
  });
});
