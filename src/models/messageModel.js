const pool = require('../config/db');

const getMessagesByThread = async (threadId) => {
  const res = await pool.query(
    'SELECT * FROM messages WHERE thread_id=$1 ORDER BY created_at ASC',
    [threadId]
  );
  return res.rows;
};

const createMessage = async (threadId, senderId, content) => {
  const res = await pool.query(
    'INSERT INTO messages (thread_id, sender_id, content) VALUES ($1,$2,$3) RETURNING *',
    [threadId, senderId, content]
  );
  return res.rows[0];
};

module.exports = { getMessagesByThread, createMessage };