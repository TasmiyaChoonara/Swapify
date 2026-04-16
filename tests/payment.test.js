jest.mock('../src/models/payment');
jest.mock('../src/services/paypalService');

// Mock the db pool before anything imports it
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const paymentModel = require('../src/models/payment');
const paypalService = require('../src/services/paypalService');
const pool = require('../src/config/db');
const paymentService = require('../src/services/paymentService');

const TRANSACTION_ID = 'txn-uuid-001';
const PAYMENT_ID = 'pay-uuid-001';
const PAYPAL_ORDER_ID = 'PP-ORDER-001';

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [{ id: TRANSACTION_ID }] });
});

describe('paymentService.initiatePayment()', () => {
  test('throws 400 when totalPrice is zero', async () => {
    await expect(
      paymentService.initiatePayment({ transactionId: TRANSACTION_ID, totalPrice: 0, onlineAmount: 0 })
    ).rejects.toMatchObject({ status: 400 });
  });
  test('throws 400 when onlineAmount exceeds totalPrice', async () => {
    await expect(
      paymentService.initiatePayment({ transactionId: TRANSACTION_ID, totalPrice: 100, onlineAmount: 150 })
    ).rejects.toMatchObject({ status: 400 });
  });
  test('throws 404 when transaction does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(
      paymentService.initiatePayment({ transactionId: 'bad-id', totalPrice: 100, onlineAmount: 50 })
    ).rejects.toMatchObject({ status: 404 });
  });
  test('calculates cashShortfall correctly', async () => {
    paymentModel.create.mockResolvedValue({ id: PAYMENT_ID, status: 'pending' });
    paypalService.createOrder.mockResolvedValue({
      id: PAYPAL_ORDER_ID,
      links: [{ rel: 'approve', href: 'https://paypal.com/approve' }],
    });
    const result = await paymentService.initiatePayment({ transactionId: TRANSACTION_ID, totalPrice: 500, onlineAmount: 300 });
    expect(result.cashShortfall).toBe(200);
  });
  test('skips PayPal when onlineAmount is 0', async () => {
    paymentModel.create.mockResolvedValue({ id: PAYMENT_ID });
    const result = await paymentService.initiatePayment({ transactionId: TRANSACTION_ID, totalPrice: 200, onlineAmount: 0 });
    expect(paypalService.createOrder).not.toHaveBeenCalled();
    expect(result.cashShortfall).toBe(200);
  });
  test('returns approvalUrl from PayPal', async () => {
    paymentModel.create.mockResolvedValue({ id: PAYMENT_ID });
    paypalService.createOrder.mockResolvedValue({
      id: PAYPAL_ORDER_ID,
      links: [{ rel: 'approve', href: 'https://paypal.com/approve' }],
    });
    const result = await paymentService.initiatePayment({ transactionId: TRANSACTION_ID, totalPrice: 100, onlineAmount: 100 });
    expect(result.approvalUrl).toBe('https://paypal.com/approve');
  });
});

describe('paymentService.capturePayment()', () => {
  test('throws 404 when payment not found', async () => {
    paymentModel.findById.mockResolvedValue(null);
    await expect(
      paymentService.capturePayment({ paymentId: 'bad', paypalOrderId: PAYPAL_ORDER_ID })
    ).rejects.toMatchObject({ status: 404 });
  });
  test('is idempotent when already paid', async () => {
    paymentModel.findById.mockResolvedValue({ id: PAYMENT_ID, status: 'paid' });
    const result = await paymentService.capturePayment({ paymentId: PAYMENT_ID, paypalOrderId: PAYPAL_ORDER_ID });
    expect(paypalService.captureOrder).not.toHaveBeenCalled();
    expect(result.status).toBe('paid');
  });
  test('marks failed when PayPal capture not COMPLETED', async () => {
    paymentModel.findById.mockResolvedValue({ id: PAYMENT_ID, status: 'pending' });
    paypalService.captureOrder.mockResolvedValue({ status: 'VOIDED' });
    paymentModel.markFailed.mockResolvedValue({ id: PAYMENT_ID, status: 'failed' });
    await expect(
      paymentService.capturePayment({ paymentId: PAYMENT_ID, paypalOrderId: PAYPAL_ORDER_ID })
    ).rejects.toMatchObject({ status: 402 });
    expect(paymentModel.markFailed).toHaveBeenCalledWith(PAYMENT_ID);
  });
  test('marks paid on successful capture', async () => {
    paymentModel.findById.mockResolvedValue({ id: PAYMENT_ID, status: 'pending' });
    paypalService.captureOrder.mockResolvedValue({ status: 'COMPLETED' });
    paymentModel.markPaid.mockResolvedValue({ id: PAYMENT_ID, status: 'paid', paypal_order_id: PAYPAL_ORDER_ID });
    const result = await paymentService.capturePayment({ paymentId: PAYMENT_ID, paypalOrderId: PAYPAL_ORDER_ID });
    expect(result.status).toBe('paid');
  });
});
