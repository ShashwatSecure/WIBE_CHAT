const mongoose = require('mongoose');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const Message = require('../models/Message');

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { userId, name, username, email } = req.body;
    let profilePicture = req.file ? `/uploads/profile_pictures/${req.file.filename}` : undefined;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid User ID format' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if username is already taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ msg: 'Username already taken' });
      }
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ msg: 'Email already taken' });
      }
    }

    // Update user fields
    if (name) user.name = name;
    if (username) user.username = username;
    if (email) user.email = email;
    if (profilePicture) user.profilePicture = profilePicture;

    await user.save();

    res.status(200).json({
      msg: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        profilePicture: user.profilePicture
      }
    });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Upload single file
exports.uploadSingleFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded.' });
    }
    res.json({ filePath: `/uploads/profile_pictures/${req.file.filename}` });
  } catch (err) {
    console.error('Upload single file error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Block/Unblock user
exports.blockUser = async (req, res) => {
  try {
    const { blockerId, blockedId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(blockerId) || !mongoose.Types.ObjectId.isValid(blockedId)) {
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    const blocker = await User.findById(blockerId);
    const blocked = await User.findById(blockedId);

    if (!blocker || !blocked) {
      return res.status(404).json({ msg: 'Blocker or Blocked user not found' });
    }

    // Initialize blockedUsers if it doesn't exist
    if (!blocker.blockedUsers) {
      blocker.blockedUsers = [];
    }

    const blockedIndex = blocker.blockedUsers.indexOf(blockedId);
    let action = '';

    if (blockedIndex === -1) {
      // Block user
      blocker.blockedUsers.push(blockedId);
      action = 'blocked';
    } else {
      // Unblock user
      blocker.blockedUsers.splice(blockedIndex, 1);
      action = 'unblocked';
    }

    await blocker.save();

    // Fetch updated block status for both users
    const user1 = await User.findById(blockerId);
    const user2 = await User.findById(blockedId);

    const user1BlockedUser2 = user1.blockedUsers.includes(blockedId);
    const user2BlockedUser1 = user2.blockedUsers ? user2.blockedUsers.includes(blockerId) : false;

    // Emit socket event to both users
    const io = req.app.get('io');
    if (io) {
      io.to(blockerId).emit('blockStatusUpdate', { user1Id: blockerId, user2Id: blockedId, user1BlockedUser2, user2BlockedUser1 });
      io.to(blockedId).emit('blockStatusUpdate', { user1Id: blockerId, user2Id: blockedId, user1BlockedUser2, user2BlockedUser1 });
    }

    res.status(200).json({ msg: `User ${action} successfully` });

  } catch (err) {
    console.error('Block/Unblock user error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get block status
exports.getBlockStatus = async (req, res) => {
  try {
    const { user1Id, user2Id } = req.query;

    if (!mongoose.Types.ObjectId.isValid(user1Id) || !mongoose.Types.ObjectId.isValid(user2Id)) {
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    const user1 = await User.findById(user1Id);
    const user2 = await User.findById(user2Id);

    if (!user1 || !user2) {
      return res.status(404).json({ msg: 'One or both users not found' });
    }

    // Initialize blockedUsers if they don't exist
    if (!user1.blockedUsers) user1.blockedUsers = [];
    if (!user2.blockedUsers) user2.blockedUsers = [];

    const user1BlockedUser2 = user1.blockedUsers.includes(user2Id);
    const user2BlockedUser1 = user2.blockedUsers.includes(user1Id);

    res.status(200).json({ user1BlockedUser2, user2BlockedUser1 });

  } catch (err) {
    console.error('Get block status error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Search users
exports.searchUsers = async (req, res) => {
  try {
    const { email, username, name } = req.query;

    if (!email && !username && !name) {
      return res.status(400).json({ msg: 'Email, username, or name query parameter is required' });
    }

    const query = { $or: [] };

    if (email) {
      query.$or.push({ email: { $regex: email, $options: 'i' } });
    }
    if (username) {
      query.$or.push({ username: { $regex: username, $options: 'i' } });
    }
    if (name) {
      query.$or.push({ name: { $regex: name, $options: 'i' } });
    }

    if (query.$or.length === 0) {
      return res.status(400).json({ msg: 'Email, username, or name query parameter is required' });
    }

    const users = await User.find(query).select('-password');

    if (users.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json({ users });
  } catch (err) {
    console.error('User search error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get unread message counts
exports.getUnreadCounts = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid User ID format' });
    }

    const unreadCounts = await Message.aggregate([
      {
        $match: {
          receiver: new mongoose.Types.ObjectId(userId),
          status: { $ne: 'seen' }
        }
      },
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          senderId: '$_id',
          count: 1
        }
      }
    ]);

    const formattedUnreadCounts = unreadCounts.reduce((acc, item) => {
      acc[item.senderId.toString()] = item.count;
      return acc;
    }, {});

    res.json(formattedUnreadCounts);
  } catch (error) {
    console.error('Error fetching unread counts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get cloud storage usage
exports.getCloudStorageUsage = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid User ID format' });
    }

    const user = await User.findById(userId).select('cloudStorageUsed');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.status(200).json({ cloudStorageUsed: user.cloudStorageUsed });
  } catch (err) {
    console.error('Fetch cloud storage usage error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid User ID format' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.status(200).json({ user });
  } catch (err) {
    console.error('Get user by ID error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get user online status
exports.getUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid User ID format' });
    }

    const user = await User.findById(userId).select('online lastSeen');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.status(200).json({
      online: user.online,
      lastSeen: user.lastSeen
    });
  } catch (err) {
    console.error('Get user status error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};