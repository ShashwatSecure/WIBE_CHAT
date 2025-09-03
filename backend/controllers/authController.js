// controllers/authController.js
const User = require('../models/User');
const OTP = require('../models/OTP');
const sendOTP = require('../utils/sendOTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// =======================================================
// Utility: Generate Access & Refresh Tokens
// =======================================================
const generateTokens = (user) => {
  // Access token: short lived (15 min)
  const accessToken = jwt.sign(
    { userId: user._id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "30m" }
  );

  // Refresh token: long lived (7 days)
  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

// =======================================================
// REGISTER (Step 1: Send OTP)
// =======================================================
exports.register = async (req, res) => {
  const { name, email, password, username } = req.body;

  try {
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user && user.isVerified) {
      return res.status(400).json({ success: false, msg: 'User with this email already exists' });
    }

    // Check username uniqueness 
    // this must be handled in frontend while user is typing
    // but we double-check here for safety
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ success: false, msg: 'Username already taken' });
    }

    // Generate OTP (6-digit)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP (will auto-expire via TTL index in OTP model)
    await OTP.create({ email, otp, createdAt: new Date() });

    // Send OTP via email
    await sendOTP(
      email,
      otp,
      'Wibe_Chat Registration OTP',
      `<p>Your One-Time Password (OTP) for Wibe_Chat registration is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes.</p>`
    );

    res.status(200).json({ success: true, msg: 'OTP sent to your email. Please verify.' });

  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ success: false, msg: 'Server Error' });
  }
};

// =======================================================
// VERIFY OTP & CREATE USER (Step 2)
// =======================================================
exports.verifyOtp = async (req, res) => {
  const { email, otp, name, password, username } = req.body;

  try {
    // Validate OTP (must exist & not older than 5 min)
    const otpRecord = await OTP.findOne({
      email,
      otp,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, msg: 'Invalid or expired OTP' });
    }

    // Create or update user
    let user = await User.findOne({ email });

    if (user) {
      if (!user.isVerified) {
        user.name = name;
        user.password = await bcrypt.hash(password, 10);
        user.username = username;
        user.isVerified = true;
        await user.save();
      } else {
        return res.status(400).json({ success: false, msg: 'User already verified' });
      }
    } else {
      user = new User({
        name,
        email,
        password: await bcrypt.hash(password, 10),
        username,
        isVerified: true,
      });
      await user.save();
    }

    // Delete OTP after success
    await OTP.deleteOne({ email, otp });

    // Issue tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh token in DB for rotation
    user.refreshToken = refreshToken;
    await user.save();

    // Send refresh token as HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      success: true,
      msg: 'User registered and verified successfully',
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        profilePicture: user.profilePicture,
      },
    });

  } catch (err) {
    console.error("Verify OTP error:", err.message);
    res.status(500).json({ success: false, msg: 'Server Error' });
  }
};

// =======================================================
// SIGNIN
// =======================================================
exports.signin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !user.isVerified) {
      return res.status(400).json({ msg: 'Invalid Credentials or user not verified' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    // if (!isMatch) {
    //   return res.status(400).json({ msg: 'Wrong password' });
    // }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Send refresh token in cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      msg: 'Logged in successfully',
      accessToken,
      userId: user._id,
      userName: user.name,
      username: user.username,
      profilePicture: user.profilePicture
    });

  } catch (err) {
    console.error('Signin error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// =======================================================
// REFRESH TOKEN
// =======================================================
exports.refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ msg: 'No refresh token provided' });

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== token) {
      return res.status(403).json({ msg: 'Invalid refresh token' });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Rotate refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Send new refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken });

  } catch (err) {
    console.error('Refresh token error:', err.message);
    res.clearCookie('refreshToken'); // ensure logout if invalid
    res.status(403).json({ msg: 'Invalid or expired refresh token' });
  }
};

// =======================================================
// LOGOUT
// =======================================================
exports.logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.REFRESH_SECRET);
        const user = await User.findById(decoded.userId);
        if (user) {
          user.refreshToken = null;
          await user.save();
        }
      } catch {
        // Even if token expired, just clear cookie
      }
    }

    res.clearCookie('refreshToken');
    res.json({ msg: 'Logged out successfully' });

  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// =======================================================
// FORGOT PASSWORD (Step 1)
// =======================================================
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, msg: 'No account found with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({ email, otp, createdAt: new Date() });

    await sendOTP(
      email,
      otp,
      'Password Reset OTP',
      `<p>Your OTP for password reset is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes.</p>`
    );

    res.status(200).json({ success: true, msg: 'OTP sent to your email.' });

  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ success: false, msg: 'Server Error' });
  }
};

// =======================================================
// VERIFY RESET OTP (Step 2)
// =======================================================
exports.verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const otpRecord = await OTP.findOne({
      email,
      otp,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, msg: 'Invalid or expired OTP' });
    }

    res.status(200).json({ success: true, msg: 'OTP verified successfully' });

  } catch (err) {
    console.error("Verify reset OTP error:", err.message);
    res.status(500).json({ success: false, msg: 'Server Error' });
  }
};

// =======================================================
// RESET PASSWORD (Step 3)
// =======================================================
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const otpRecord = await OTP.findOne({
      email,
      otp,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, msg: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User not found' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await OTP.deleteOne({ email, otp });

    res.status(200).json({ success: true, msg: 'Password has been reset successfully' });

  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ success: false, msg: 'Server Error' });
  }
};
