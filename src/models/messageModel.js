const pool = require('../config/db');

const getMessagesByThread = async (threadId) => {
  const res = await pool.query(
    `SELECT m.*, u.name AS sender_name
     FROM messages m
     LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.thread_id = $1
     ORDER BY m.sent_at ASC`,
    [threadId]
  );
  return res.rows;
};

const createMessage = async (threadId, senderId, content) => {
  const res = await pool.query(
    `WITH inserted AS (
       INSERT INTO messages (thread_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING *
     )
     SELECT i.*, u.name AS sender_name
     FROM inserted i
     LEFT JOIN users u ON u.id = i.sender_id`,
    [threadId, senderId, content]
  );
  return res.rows[0];
};

module.exports = { getMessagesByThread, createMessage };
