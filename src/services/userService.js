const userModel = require('../models/user');

const VALID_ROLES = ['student', 'staff', 'admin'];

async function getOrCreateUser(clerkUser) {
  const authId = clerkUser.id;
  const existing = await userModel.findByAuthId(authId);

  const email = clerkUser.emailAddresses?.[0]?.emailAddress || `${authId}@placeholder.com`;
  const firstName = clerkUser.firstName || '';
  const lastName = clerkUser.lastName || '';
  const name = `${firstName} ${lastName}`.trim() || email;

  if (existing) {
    // Update name and email if they were placeholder values
    const isPlaceholderName = existing.name && existing.name.includes('@placeholder.com');
    const isPlaceholderEmail = existing.email && existing.email.includes('@placeholder.com');
    if ((isPlaceholderName || isPlaceholderEmail) && (firstName || lastName)) {
      await userModel.updateNameAndEmail(existing.id, name, email);
      return { ...existing, name, email };
    }
    return existing;
  }

  return userModel.create({ name, email, authId });
}

async function getUserProfile(id) {
  const user = await userModel.findById(id);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return user;
}

async function updateUserRole(id, role) {
  if (!VALID_ROLES.includes(role)) {
    const err = new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const user = await userModel.updateRole(id, role);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return user;
}

async function getAllUsers() {
  return userModel.findAll();
}

async function adminUpdateUserRole(targetId, role) {
  if (!VALID_ROLES.includes(role)) {
    const err = new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    err.status = 400;
    throw err;
  }
  const user = await userModel.updateRole(targetId, role);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return user;
}

module.exports = { getOrCreateUser, getUserProfile, updateUserRole, getAllUsers, adminUpdateUserRole };
