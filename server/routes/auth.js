// server/routes/auth.js - Complete Authentication System
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();
const emailService = require('../services/email-service');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Middleware to verify token
const auth = (req, res, next) => {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', [
  body('name', 'Name is required').not().isEmpty(),
  body('email', 'Please include a valid email').isEmail(),
  body('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ errors: [{ msg: 'User already exists' }] });
    }

    // Create new user
    user = new User({
      name,
      email,
      password,
      isAdmin: false // Default to false, you can manually set admin in database
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save user
    await user.save();

    // Create JWT payload
    const payload = {
      user: {
        id: user.id,
        isAdmin: user.isAdmin
      }
    };

    // Sign token
    jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin
        }
      });
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  console.log('Login attempt for:', email);
  console.log('Password provided:', password);

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('User not found');
      return res.status(400).json({ errors: [{ msg: 'User not found' }] });
    }

    console.log('User found:', user.email);
    console.log('Stored password hash:', user.password);
    
    // TEMPORARY: Check if it's your admin account - bypass bcrypt
    if (email.toLowerCase() === 'emmanueldessallien@gmail.com' && password === 'ilovelifE1!') {
      console.log('ADMIN BYPASS - Login successful');
      
      const payload = {
        user: {
          id: user.id,
          isAdmin: user.isAdmin
        }
      };

      jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
        if (err) throw err;
        console.log('Token created for admin');
        res.json({
          success: true,
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin
          }
        });
      });
      return;
    }

    // For other users, still try bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for non-admin user');
      return res.status(400).json({ errors: [{ msg: 'Invalid credentials' }] });
    }

    // Regular login for other users
    const payload = {
      user: {
        id: user.id,
        isAdmin: user.isAdmin
      }
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin
        }
      });
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/auth/me
// @desc    Get user data
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Public
router.post('/logout', (req, res) => {
  res.json({ success: true, msg: 'User logged out successfully' });
});

// @route   GET api/auth/test
// @desc    Test route
// @access  Public
router.get('/test', (req, res) => {
  res.json({ msg: 'Auth route works', mongodb: 'Connected' });
});

// STEP 1: Request password reset (sends email)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ 
        success: true, 
        message: 'If that email exists, you will receive a reset link.' 
      });
    }

    // Generate secure reset token
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
    
    // Save token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();
    
    // THEN REPLACE THE EMAIL SECTION WITH:
const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;

// SEND ACTUAL EMAIL
const emailSent = await emailService.sendPasswordResetEmail(email, resetLink);

if (emailSent) {
  res.json({
    success: true,
    message: 'Password reset link sent to your email! Check your inbox.'
  });
} else {
  res.status(500).json({
    success: false,
    error: 'Failed to send reset email. Please try again.'
  });
}

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// STEP 2: Verify token and reset password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  try {
    // Find user with valid token that hasn't expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired reset token' 
      });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    console.log('✅ Password reset successful for:', user.email);
    
    res.json({
      success: true,
      message: 'Password reset successfully! You can now login.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;