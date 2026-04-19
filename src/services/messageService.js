const messageModel = require('../models/messageModel');

const fetchMessages = async (threadId) => {
  return await messageModel.getMessagesByThread(threadId);
};

const sendMessage = async (threadId, senderId, content) => {
  if (!content) throw new Error("Message cannot be empty");
  return await messageModel.createMessage(threadId, senderId, content);
};

module.exports = { fetchMessages, sendMessage };