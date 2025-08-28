const User = require('../models/User');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');

// Set up multer for profile picture uploads
const profilePictureStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/profile_pictures/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const uploadMiddleware = multer({ storage: profilePictureStorage });

exports.uploadProfilePicture = uploadMiddleware;
exports.uploadSingleProfilePicture = uploadMiddleware;

exports.updateUserProfile = async (req, res) => {
  const { email, name, username, newPassword, oldPassword, profilePicture } = req.body;
  console.log('Received profile update request for email:', email);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(404).json({ msg: 'User not found' });
    }

    if (name) {
      user.name = name;
    }
    if (username && user.username !== username) {
      if (username.includes('@')) {
        return res.status(400).json({ msg: 'Username cannot contain the "@" symbol.' });
      }
      const existingUsername = await User.findOne({ username });
      if (existingUsername && existingUsername._id.toString() !== user._id.toString()) {
        return res.status(400).json({ msg: 'Username already taken' });
      }
      user.username = username;
    }

    if (profilePicture) {
      user.profilePicture = profilePicture;
      console.log('Updating user profilePicture.');
    }

    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({ msg: 'Old password is required to change password' });
      }
      const isOldPasswordMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isOldPasswordMatch) {
        return res.status(400).json({ msg: 'Incorrect old password' });
      }
      user.password = newPassword;
    }

    await user.save();
    console.log('User saved successfully. New profilePicture in DB:', user.profilePicture);
    res.json({ msg: 'Profile updated successfully', userName: user.name, username: user.username, profilePicture: user.profilePicture });

  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};