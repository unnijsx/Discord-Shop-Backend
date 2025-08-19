// server/controllers/userController.js
import User from '../models/User.js';

// --- Authorization Middleware ---
// Levels: Client < Staff < Admin
export const authorize = (requiredRoles) => (req, res, next) => {
  if (!req.session.user || !req.session.user.userType) {
    return res.status(403).json({ message: 'Access denied. User role not found.' });
  }

  const userRole = req.session.user.userType;

  // Simple role hierarchy check
  const roleHierarchy = { 'Client': 1, 'Staff': 2, 'Admin': 3 };

  const hasPermission = requiredRoles.some(role =>
    roleHierarchy[userRole] >= roleHierarchy[role]
  );

  if (hasPermission) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
  }
};

// Middleware to protect routes (ensure user is logged in)
export const protect = (req, res, next) => {
  if (req.session.user && req.session.user.id) {
    next();
  } else {
    req.session.destroy(err => {
      if (err) console.error('Error destroying session on unauthorized access:', err);
      res.clearCookie('connect.sid');
      res.status(401).json({ message: 'Not authorized, please log in.' });
    });
  }
};

// Get current logged-in user's profile
export const getMe = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ message: 'Not logged in.' });
    }
    const user = await User.findById(req.session.user.id).select('-__v');
    if (!user) {
      req.session.destroy();
      res.clearCookie('connect.sid');
      return res.status(404).json({ message: 'User not found in database. Session cleared.' });
    }
    // Update session with fresh data (important for userType, credits, etc.)
      req.session.user = {
      id: user._id,
      discordId: user.discordId,
      username: user.username,
      avatar: user.avatar,
      email: user.email,
      credits: user.credits,
      userType: user.userType,
      referralCode: user.referralCode // <--- ENSURE THIS LINE IS PRESENT
    };
    res.json({ loggedIn: true, user: req.session.user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error fetching user profile.' });
  }
};

// Update user credits (used internally by order processing or admin)
export const updateCredits = async (userId, amount) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found for credit update.');
    }
    user.credits += amount;
    await user.save();
    console.log(`Credits updated for user ${user.username} (${userId}): New credits ${user.credits}`);
    return user.credits;
  } catch (error) {
    console.error(`Failed to update credits for user ${userId}:`, error);
    throw error;
  }
};

// --- Admin/Staff User Management ---

// Get all users (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-__v -password'); // Exclude sensitive/unnecessary fields
    res.json(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ message: 'Server error fetching users.' });
  }
};

// Update user type (Admin only)
export const updateUserType = async (req, res) => {
  const { userId } = req.params;
  const { newType } = req.body;

  if (!['Client', 'Staff', 'Admin'].includes(newType)) {
    return res.status(400).json({ message: 'Invalid user type.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.userType = newType;
    await user.save();

    res.json({ message: `User ${user.username} type updated to ${newType}.` });
  } catch (error) {
    console.error('Error updating user type:', error);
    res.status(500).json({ message: 'Server error updating user type.' });
  }
};

// Get user by referral code
export const getUserByReferralCode = async (referralCode) => {
  try {
    const user = await User.findOne({ referralCode });
    return user;
  } catch (error) {
    console.error('Error getting user by referral code:', error);
    throw error;
  }
};