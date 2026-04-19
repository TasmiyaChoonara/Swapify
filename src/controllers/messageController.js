const messageService = require('../services/messageService');

const getMessages = async (req, res) => {
  try {
    const { threadId } = req.params;
    const messages = await messageService.fetchMessages(threadId);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { threadId, senderId, content } = req.body;
    const message = await messageService.sendMessage(threadId, senderId, content);
    res.json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { getMessages, sendMessage };