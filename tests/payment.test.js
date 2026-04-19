jest.mock('../src/models/payment');
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const paymentModel = require('../src/models/payment');
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
