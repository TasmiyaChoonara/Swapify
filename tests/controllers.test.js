'use strict';

jest.mock('../src/services/facilityConfigService');
jest.mock('../src/services/messageService');
jest.mock('../src/services/paymentService');

const facilityConfigService = require('../src/services/facilityConfigService');
const messageService        = require('../src/services/messageService');
const paymentService        = require('../src/services/paymentService');

const { getConfig, updateDayConfig } = require('../src/controllers/facilityConfigController');
const { getMessages, sendMessage }   = require('../src/controllers/messageController');
const { initiatePayment, getByTransaction } = require('../src/controllers/paymentController');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

// ─── facilityConfigController ─────────────────────────────────────────────────

describe('facilityConfigController.getConfig', () => {
  test('200 with full config array', async () => {
    const cfg = [{ day_of_week: 1, open_time: '08:00', close_time: '18:00', slot_capacity: 5 }];
    facilityConfigService.getAllConfig.mockResolvedValue(cfg);
    const req = {};
    const res = makeRes();
    await getConfig(req, res);
    expect(res.json).toHaveBeenCalledWith(cfg);
  });

  test('500 on service error', async () => {
    facilityConfigService.getAllConfig.mockRejectedValue(new Error('DB down'));
    const req = {};
    const res = makeRes();
    await getConfig(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'DB down' });
  });

  test('uses err.status when service throws a status error', async () => {
    const err = Object.assign(new Error('Not ready'), { status: 503 });
    facilityConfigService.getAllConfig.mockRejectedValue(err);
    const res = makeRes();
    await getConfig({}, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});

describe('facilityConfigController.updateDayConfig', () => {
  const validBody = { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00', slotCapacity: 5 };

  test('200 with updated day config', async () => {
    const updated = { day_of_week: 1, open_time: '08:00', close_time: '18:00', slot_capacity: 5 };
    facilityConfigService.updateDayConfig.mockResolvedValue(updated);
    const req = { body: validBody, user: { id: 'staff-1' } };
    const res = makeRes();
    await updateDayConfig(req, res);
    expect(facilityConfigService.updateDayConfig).toHaveBeenCalledWith(
      expect.objectContaining({ dayOfWeek: 1, updatedBy: 'staff-1' })
    );
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test('400 when service throws a validation error', async () => {
    const err = Object.assign(new Error('openTime must be before closeTime'), { status: 400 });
    facilityConfigService.updateDayConfig.mockRejectedValue(err);
    const req = { body: { dayOfWeek: 1, openTime: '18:00', closeTime: '08:00', slotCapacity: 5 }, user: { id: 'staff-1' } };
    const res = makeRes();
    await updateDayConfig(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'openTime must be before closeTime' });
  });

  test('500 on unexpected service error', async () => {
    facilityConfigService.updateDayConfig.mockRejectedValue(new Error('crash'));
    const req = { body: validBody, user: { id: 'staff-1' } };
    const res = makeRes();
    await updateDayConfig(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── messageController ────────────────────────────────────────────────────────

describe('messageController.getMessages', () => {
  test('200 with messages array', async () => {
    const msgs = [{ id: 'm1', content: 'Hi' }, { id: 'm2', content: 'Hello' }];
    messageService.fetchMessages.mockResolvedValue(msgs);
    const req = { params: { threadId: 'thread-1' } };
    const res = makeRes();
    await getMessages(req, res);
    expect(messageService.fetchMessages).toHaveBeenCalledWith('thread-1');
    expect(res.json).toHaveBeenCalledWith(msgs);
  });

  test('200 with empty array when no messages exist', async () => {
    messageService.fetchMessages.mockResolvedValue([]);
    const req = { params: { threadId: 'thread-empty' } };
    const res = makeRes();
    await getMessages(req, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('500 on service error', async () => {
    messageService.fetchMessages.mockRejectedValue(new Error('DB error'));
    const req = { params: { threadId: 'thread-1' } };
    const res = makeRes();
    await getMessages(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'DB error' });
  });
});

describe('messageController.sendMessage', () => {
  test('200 with created message', async () => {
    const msg = { id: 'm1', thread_id: 'thread-1', sender_id: 'user-1', content: 'Hi there' };
    messageService.sendMessage.mockResolvedValue(msg);
    const req = { body: { threadId: 'thread-1', content: 'Hi there' }, user: { id: 'user-1' } };
    const res = makeRes();
    await sendMessage(req, res);
    expect(messageService.sendMessage).toHaveBeenCalledWith('thread-1', 'user-1', 'Hi there');
    expect(res.json).toHaveBeenCalledWith(msg);
  });

  test('400 when content is empty (service throws)', async () => {
    messageService.sendMessage.mockRejectedValue(new Error('Message cannot be empty'));
    const req = { body: { threadId: 'thread-1', content: '' }, user: { id: 'user-1' } };
    const res = makeRes();
    await sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Message cannot be empty' });
  });

  test('senderId is always taken from req.user, never from req.body', async () => {
    messageService.sendMessage.mockResolvedValue({});
    const req = { body: { threadId: 't1', content: 'Test', senderId: 'evil-id' }, user: { id: 'real-user-id' } };
    const res = makeRes();
    await sendMessage(req, res);
    expect(messageService.sendMessage).toHaveBeenCalledWith('t1', 'real-user-id', 'Test');
  });
});

// ─── paymentController ────────────────────────────────────────────────────────

describe('paymentController.initiatePayment', () => {
  const validBody = {
    transactionId: 'txn-1', totalPrice: 150, listingId: 'l1', itemName: 'Textbook',
  };

  test('201 with payment result', async () => {
    const result = { payfastUrl: 'https://sandbox.payfast.co.za/eng/process', paymentData: {} };
    paymentService.initiatePayment.mockResolvedValue(result);
    const req = { body: validBody };
    const res = makeRes();
    await initiatePayment(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('400 when service throws a 400 error', async () => {
    const err = Object.assign(new Error('totalPrice must be positive'), { status: 400 });
    paymentService.initiatePayment.mockRejectedValue(err);
    const req = { body: { ...validBody, totalPrice: 0 } };
    const res = makeRes();
    await initiatePayment(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'totalPrice must be positive' });
  });

  test('404 when transaction not found', async () => {
    const err = Object.assign(new Error('Transaction not found'), { status: 404 });
    paymentService.initiatePayment.mockRejectedValue(err);
    const req = { body: { ...validBody, transactionId: 'bad-txn' } };
    const res = makeRes();
    await initiatePayment(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 on unexpected error', async () => {
    paymentService.initiatePayment.mockRejectedValue(new Error('crash'));
    const req = { body: validBody };
    const res = makeRes();
    await initiatePayment(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('paymentController.getByTransaction', () => {
  test('200 with payment record', async () => {
    const pay = { id: 'pay-1', status: 'pending', amount: 150 };
    paymentService.getPaymentByTransaction.mockResolvedValue(pay);
    const req = { params: { transactionId: 'txn-1' } };
    const res = makeRes();
    await getByTransaction(req, res);
    expect(res.json).toHaveBeenCalledWith(pay);
  });

  test('404 when payment not found', async () => {
    const err = Object.assign(new Error('Payment not found'), { status: 404 });
    paymentService.getPaymentByTransaction.mockRejectedValue(err);
    const req = { params: { transactionId: 'bad-txn' } };
    const res = makeRes();
    await getByTransaction(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment not found' });
  });

  test('500 on unexpected error', async () => {
    paymentService.getPaymentByTransaction.mockRejectedValue(new Error('crash'));
    const req = { params: { transactionId: 'txn-1' } };
    const res = makeRes();
    await getByTransaction(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
