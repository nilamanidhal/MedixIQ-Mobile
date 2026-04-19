const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/auth/register-profile
// @desc    Create MongoDB profile AFTER Firebase creates the account
router.post('/register-profile', authMiddleware, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('age').isInt({ min: 1, max: 150 }).withMessage('Age must be between 1 and 150'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    // Check if profile already exists to prevent duplicates
    let user = await User.findOne({ firebaseUid: req.firebaseUid });
    if (user) {
      return res.status(400).json({ message: 'User profile already exists' });
    }

    // Create new MongoDB user linked to the Firebase UID
    user = new User({
      firebaseUid: req.firebaseUid,
      email: req.firebaseEmail, // Safely pulled from the verified token
      name: req.body.name,
      age: req.body.age,
      gender: req.body.gender,
      lastLogin: new Date()
    });

    await user.save();

    res.status(201).json({ message: 'Profile created successfully', user });
  } catch (error) {
    console.error('Profile Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @route   GET /api/auth/me
// @desc    Get logged in user's data (React calls this after Firebase Login)
router.get('/me', authMiddleware, async (req, res) => {
    try {
      if (!req.user) {
          return res.status(404).json({ message: 'Profile not found. Please complete registration.' });
      }
      
      // Update last login timestamp
      req.user.lastLogin = new Date();
      await req.user.save();

      res.json({ user: req.user });
    } catch (err) {
      console.error('Fetch profile error:', err);
      res.status(500).send('Server Error');
    }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile (Name, Age, Gender)
router.put('/profile', authMiddleware, [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('age').optional().isInt({ min: 1, max: 150 }).withMessage('Age must be between 1 and 150'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other')
], async (req, res) => {
  try {
    if (!req.user) return res.status(404).json({ message: 'User not found' });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { name, age, gender } = req.body;
    
    if (name) req.user.name = name;
    if (age) req.user.age = age;
    if (gender) req.user.gender = gender;

    await req.user.save();

    res.json({ message: 'Profile updated successfully', user: req.user });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/auth/heartbeat
// Silently updates the user's last active timestamp
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/heartbeat', authMiddleware, async (req, res) => {
    try {
        // req.user is attached by your authMiddleware
        req.user.lastLogin = new Date(); // Updating lastLogin to act as 'lastActive'
        await req.user.save();
        
        res.status(200).json({ success: true, message: "Activity updated" });
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ error: "Failed to update activity" });
    }
});

module.exports = router;

