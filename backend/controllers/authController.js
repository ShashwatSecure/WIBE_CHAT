// --- Auth Routes ---
const express = require('express');
const User = require('../models/User');
const OTP = require('../models/OTP');
const sendOTP = require('../utils/sendOTP');
const bcrypt = require('bcryptjs');
const authRouter = express.Router();

// Register (Send OTP)
authRouter.post('/register', async (req, res) => {
  const { name, email, password, username } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User with this email already exists' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`Generated OTP: ${otp} for email: ${email}`);
    await OTP.create({ email, otp });
    await sendOTP(email, otp, 'Hike Registration OTP', '<p>Your One-Time Password (OTP) for Hike registration is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes.</p>');

    res.status(200).json({ msg: 'OTP sent to your email. Please verify.' });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Verify OTP and Register User
authRouter.post('/verify-otp', async (req, res) => {
  const { email, otp, name, password, username } = req.body;

  try {
    const otpRecord = await OTP.findOne({ email, otp });

    if (!otpRecord) {
      return res.status(400).json({ msg: 'Invalid or expired OTP' });
    }

    let user = await User.findOne({ email });
    if (user) {
      if (!user.isVerified) {
        user.name = name;
        user.password = password;
        user.username = username; // Add username
        user.isVerified = true;
        await user.save();
      } else {
        return res.status(400).json({ msg: 'User with this email already exists and is verified' });
      }
    } else {
      // Check if username already exists
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ msg: 'Username already taken' });
      }
      user = new User({
        name,
        email,
        password,
        username, // Add username
        isVerified: true
      });
      await user.save();
    }

    await OTP.deleteOne({ email, otp });

    res.status(201).json({ msg: 'User registered and verified successfully' });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Signin
authRouter.post('/signin', async (req, res) => {
  const { email, password } = req.body; 

  try {
    const user = await User.findOne({ email }); 
    if (!user || !user.isVerified) {
      return res.status(400).json({ msg: 'Invalid Credentials or user not verified' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    res.json({ msg: 'Logged in successfully', userId: user._id, userName: user.name, username: user.username, profilePicture: user.profilePicture });

  } catch (err) {
    console.error('Signin error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Forgot Password - Send OTP
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: 'No account found with this email' });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({ email, otp });
    await sendOTP(email, otp, 'Password Reset OTP', '<p>Your OTP for password reset is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes.</p>');
    res.status(200).json({ msg: 'OTP sent to your email.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Verify OTP for Password Reset
authRouter.post('/verify-reset-otp', async (req, res) => {
  const { email, otp } = req.body;
  try {
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ msg: 'Invalid or expired OTP' });
    }
    res.status(200).json({ msg: 'OTP verified successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Reset Password
authRouter.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ msg: 'Invalid or expired OTP. Please try again.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    await OTP.deleteOne({ email, otp });

    res.status(200).json({ msg: 'Password has been reset successfully' });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = authRouter;