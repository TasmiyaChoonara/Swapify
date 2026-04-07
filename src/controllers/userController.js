const userService = require('../services/userService');

async function getAllUsers(req, res) {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function adminUpdateRole(req, res) {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role is required' });
    const user = await userService.adminUpdateUserRole(req.params.id, role);
    res.json(user);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function getMe(req, res) {
  try {
    const user = await userService.getUserProfile(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function updateMyRole(req, res) {
  try {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: 'role is required' });
    }
    const user = await userService.updateUserRole(req.user.id, role);
    res.json(user);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { getMe, updateMyRole, getAllUsers, adminUpdateRole };
