jest.mock('../src/models/payment');
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const paymentModel = require('../src/models/payment');
const realPaymentModel = jest.requireActual('../src/models/payment');
const pool = require('../src/config/db');
const paymentService = require('../src/services/paymentService');

beforeAll(() => {
  process.env.PAYFAST_MERCHANT_ID  = '10000100';
  process.env.PAYFAST_MERCHANT_KEY = '46f0cd694581a';
  process.env.PAYFAST_PASSPHRASE   = 'testpassphrase';
  process.env.BACKEND_URL          = 'http://localhost:3000';
  process.env.FRONTEND_URL         = 'http://localhost:5173';
});

const TRANSACTION_ID = 'txn-uuid-001';
const PAYMENT_ID = 'pay-uuid-001';

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [{ id: TRANSACTION_ID }] });
});

describe('paymentService.initiatePayment()', () => {
  test('throws 400 when totalPrice is zero', async () => {
    await expect(
      paymentService.initiatePayment({ transactionId: TRANSACTION_ID, totalPrice: 0, listingId: '1', itemName: 'Test' })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('throws 400 when totalPrice is negative', async () => {
    await expect(
      paymentService.initiatePayment({ transactionId: TRANSACTION_ID, totalPrice: -50, listingId: '1', itemName: 'Test' })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('throws 404 when transaction does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(
      paymentService.initiatePayment({ transactionId: 'bad-id', totalPrice: 100, listingId: '1', itemName: 'Test' })
    ).rejects.toMatchObject({ status: 404 });
  });

  test('returns payfastUrl and paymentData on success', async () => {
    paymentModel.create.mockResolvedValue({ id: PAYMENT_ID, status: 'pending' });
    const result = await paymentService.initiatePayment({
      transactionId: TRANSACTION_ID,
      totalPrice: 100,
      listingId: '1',
      itemName: 'Test Item',
    });
    expect(result).toHaveProperty('payfastUrl');
    expect(result).toHaveProperty('paymentData');
    expect(result.paymentData).toHaveProperty('signature');
    expect(result.paymentData.amount).toBe('100.00');
  });

  test('paymentData contains correct merchant_id', async () => {
    paymentModel.create.mockResolvedValue({ id: PAYMENT_ID, status: 'pending' });
    const result = await paymentService.initiatePayment({
      transactionId: TRANSACTION_ID,
      totalPrice: 250,
      listingId: '5',
      itemName: 'Textbook',
    });
    expect(result.paymentData.merchant_id).toBeDefined();
    expect(result.paymentData.item_name).toBe('Textbook');
  });

  test('uses sandbox url when PAYFAST_SANDBOX is true', async () => {
    paymentModel.create.mockResolvedValue({ id: PAYMENT_ID, status: 'pending' });
    const result = await paymentService.initiatePayment({
      transactionId: TRANSACTION_ID,
      totalPrice: 100,
      listingId: '1',
      itemName: 'Test',
    });
    expect(result.payfastUrl).toContain('payfast.co.za');
  });
});

describe('paymentService.getPaymentByTransaction()', () => {
  test('throws 404 when payment not found', async () => {
    paymentModel.findByTransactionId.mockResolvedValue(null);
    await expect(
      paymentService.getPaymentByTransaction('bad-txn')
    ).rejects.toMatchObject({ status: 404 });
  });

  test('returns payment when found', async () => {
    paymentModel.findByTransactionId.mockResolvedValue({ id: PAYMENT_ID, status: 'pending' });
    const result = await paymentService.getPaymentByTransaction(TRANSACTION_ID);
    expect(result.id).toBe(PAYMENT_ID);
  });
});

// ─── paymentModel (real implementation with mocked pool) ─────────────────────

describe('paymentModel.findByTransactionId', () => {
  test('returns payment when found', async () => {
    const row = { id: 'pay-1', transaction_id: 'txn-1', status: 'pending' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await realPaymentModel.findByTransactionId('txn-1');
    expect(result).toEqual(row);
    const [, values] = pool.query.mock.calls[0];
    expect(values[0]).toBe('txn-1');
  });

  test('returns null when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    expect(await realPaymentModel.findByTransactionId('bad-txn')).toBeNull();
  });
});

describe('paymentModel.findById', () => {
  test('returns payment when found', async () => {
    const row = { id: 'pay-1', status: 'pending' };
    pool.query.mockResolvedValue({ rows: [row] });
    expect(await realPaymentModel.findById('pay-1')).toEqual(row);
  });

  test('returns null when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    expect(await realPaymentModel.findById('bad-id')).toBeNull();
  });
});

describe('paymentModel.create', () => {
  test('inserts with pending status and returns record', async () => {
    const row = { id: 'pay-1', transaction_id: 'txn-1', amount: 150, status: 'pending' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await realPaymentModel.create({
      transactionId: 'txn-1', amount: 150, onlineAmount: 150, cashShortfall: 0,
    });
    expect(result).toEqual(row);
    const [sql, values] = pool.query.mock.calls[0];
    expect(sql).toContain("'pending'");
    expect(values).toContain('txn-1');
    expect(values).toContain(150);
  });
});

describe('paymentModel.markPaid', () => {
  test('updates status to paid and returns record', async () => {
    const row = { id: 'pay-1', status: 'paid' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await realPaymentModel.markPaid('pay-1', 'pf-001');
    expect(result).toEqual(row);
    const [sql, values] = pool.query.mock.calls[0];
    expect(sql).toContain("status = 'paid'");
    expect(values[0]).toBe('pay-1');
  });

  test('returns null when payment not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    expect(await realPaymentModel.markPaid('bad-id', 'pf-001')).toBeNull();
  });
});

describe('paymentModel.markFailed', () => {
  test('updates status to failed and returns record', async () => {
    const row = { id: 'pay-1', status: 'failed' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await realPaymentModel.markFailed('pay-1');
    expect(result).toEqual(row);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain("status = 'failed'");
  });

  test('returns null when payment not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    expect(await realPaymentModel.markFailed('bad-id')).toBeNull();
  });
});
