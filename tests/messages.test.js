'use strict';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../src/services/userService', () => ({
  getOrCreateUser: jest.fn().mockResolvedValue({ id: 'db-user-1', role: 'student' }),
}));
jest.mock('jsonwebtoken', () => ({
  decode: jest.fn().mockReturnValue({ sub: 'clerk-user-1', email: 'test@test.com' }),
  sign: jest.fn().mockReturnValue('mock-token'),
}));

const pool           = require('../src/config/db');
const request        = require('supertest');
const app            = require('../src/expressApp');
const messageService = require('../src/services/messageService');
const messageModel   = require('../src/models/messageModel');

const AUTH      = 'Bearer mock-token';
const THREAD_ID = 'thread-uuid-001';
const SENDER_ID = 'db-user-1';

beforeEach(() => jest.clearAllMocks());

describe('messageService.sendMessage', () => {
  test('throws when content is empty', async () => {
    await expect(messageService.sendMessage(THREAD_ID, SENDER_ID, '')).rejects.toThrow('Message cannot be empty');
  });

  test('throws when content is undefined', async () => {
    await expect(messageService.sendMessage(THREAD_ID, SENDER_ID, undefined)).rejects.toThrow('Message cannot be empty');
  });
});

describe('messageService.fetchMessages', () => {
  test('returns rows from messageModel', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, content: 'hi', sender_name: 'Alice' }] });
    const msgs = await messageService.fetchMessages(THREAD_ID);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('hi');
  });
});

describe('messageModel.getMessagesByThread', () => {
  test('queries by thread id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const result = await messageModel.getMessagesByThread('t-1');
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toContain('t-1');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('messageModel.createMessage', () => {
  test('inserts and returns row with sender_name', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'msg-1', content: 'hello', sender_name: 'Bob' }] });
    const msg = await messageModel.createMessage('t-1', 'u-1', 'hello');
    expect(msg).toHaveProperty('sender_name', 'Bob');
  });
});

describe('GET /api/messages/:threadId', () => {
  test('401 without auth header', async () => {
    const res = await request(app).get(`/api/messages/${THREAD_ID}`);
    expect(res.status).toBe(401);
  });

  test('200 returns messages array', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 'msg-1', thread_id: THREAD_ID, content: 'Hello!', sender_name: 'Alice' },
        { id: 'msg-2', thread_id: THREAD_ID, content: 'Hey!',   sender_name: 'Bob'   },
      ],
    });
    const res = await request(app)
      .get(`/api/messages/${THREAD_ID}`)
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  test('200 returns empty array when no messages', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get(`/api/messages/${THREAD_ID}`)
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/messages', () => {
  test('401 without auth header', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ threadId: THREAD_ID, content: 'hi' });
    expect(res.status).toBe(401);
  });

  test('400 when content is empty', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', AUTH)
      .send({ threadId: THREAD_ID, content: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty/i);
  });

  test('400 when content is missing', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', AUTH)
      .send({ threadId: THREAD_ID });
    expect(res.status).toBe(400);
  });

  test('200 on valid message send', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'msg-3', thread_id: THREAD_ID, content: 'Hello!', sender_name: 'Alice' }],
    });
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', AUTH)
      .send({ threadId: THREAD_ID, content: 'Hello!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'msg-3');
    expect(res.body.content).toBe('Hello!');
  });
});
