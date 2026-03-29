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

module.exports = router;























// const express = require('express');
// const { body, validationResult } = require('express-validator');
// const jwt = require('jsonwebtoken');
// const User = require('../models/User');
// const authMiddleware = require('../middleware/auth');

// const router = express.Router();

// // Register
// router.post('/register', [
//   body('name').trim().notEmpty().withMessage('Name is required'),
//   body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
//   body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
//   body('age').isInt({ min: 1, max: 150 }).withMessage('Age must be between 1 and 150'),
//   body('gender').isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other')
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ 
//         message: 'Validation failed', 
//         errors: errors.array() 
//       });
//     }

//     const { name, email, password, age, gender } = req.body;

//     // Check if user already exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ message: 'User already exists with this email' });
//     }

//     // Create new user
//     const user = new User({
//       name,
//       email,
//       password,
//       age,
//       gender
//     });

//     await user.save();

//     // Generate JWT token
//     const token = jwt.sign(
//       { userId: user._id },
//       process.env.JWT_SECRET,
//       { expiresIn: '365d' }
//     );

//     res.status(201).json({
//       message: 'User registered successfully',
//       token,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         age: user.age,
//         gender: user.gender,
//         createdAt: user.createdAt
//       }
//     });
//   } catch (error) {
//     console.error('Registration error:', error);
//     res.status(500).json({ message: 'Server error during registration' });
//   }
// });

// // Login
// router.post('/login', [
//   body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
//   body('password').notEmpty().withMessage('Password is required')
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ 
//         message: 'Validation failed', 
//         errors: errors.array() 
//       });
//     }

//     const { email, password } = req.body;

//     // Find user by email
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ message: 'Invalid email or password' });
//     }

//     // Check password
//     const isPasswordValid = await user.comparePassword(password);
//     if (!isPasswordValid) {
//       return res.status(400).json({ message: 'Invalid email or password' });
//     }

//     user.lastLogin = new Date();
//     await user.save();

//     // Generate JWT token
//     const token = jwt.sign(
//       { userId: user._id },
//       process.env.JWT_SECRET,
//       { expiresIn: '365d' }
//     );

//     res.json({
//       message: 'Login successful',
//       token,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         age: user.age,
//         gender: user.gender,
//         createdAt: user.createdAt
//       }
//     });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ message: 'Server error during login' });
//   }
// });

// // Get current user profile
// router.get('/profile', authMiddleware, async (req, res) => {
//   try {
//     res.json({
//       user: {
//         id: req.user._id,
//         name: req.user.name,
//         email: req.user.email,
//         age: req.user.age,
//         gender: req.user.gender,
//         createdAt: req.user.createdAt
//       }
//     });
//   } catch (error) {
//     console.error('Profile fetch error:', error);
//     res.status(500).json({ message: 'Server error fetching profile' });
//   }
// });

// // Update user profile
// router.put('/profile', authMiddleware, [
//   body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
//   body('age').optional().isInt({ min: 1, max: 150 }).withMessage('Age must be between 1 and 150'),
//   body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other')
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ 
//         message: 'Validation failed', 
//         errors: errors.array() 
//       });
//     }

//     const { name, age, gender } = req.body;
//     const updateData = {};
    
//     if (name) updateData.name = name;
//     if (age) updateData.age = age;
//     if (gender) updateData.gender = gender;

//     const user = await User.findByIdAndUpdate(
//       req.user._id,
//       updateData,
//       { new: true, runValidators: true }
//     ).select('-password');

//     res.json({
//       message: 'Profile updated successfully',
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         age: user.age,
//         gender: user.gender,
//         createdAt: user.createdAt
//       }
//     });
//   } catch (error) {
//     console.error('Profile update error:', error);
//     res.status(500).json({ message: 'Server error updating profile' });
//   }
// });

// // Change Password
// router.put('/change-password', authMiddleware, [
//   body('currentPassword').notEmpty().withMessage('Current password is required'),
//   body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ 
//         message: 'Validation failed', 
//         errors: errors.array() 
//       });
//     }

//     const { currentPassword, newPassword } = req.body;

//     // Find the user explicitly to get the password field
//     const user = await User.findById(req.user._id);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // Verify current password using your existing schema method
//     const isMatch = await user.comparePassword(currentPassword);
//     if (!isMatch) {
//       return res.status(400).json({ message: 'Incorrect current password' });
//     }

//     // Update password and save (your pre-save hook will hash it automatically)
//     user.password = newPassword;
//     await user.save();

//     res.json({ message: 'Password updated successfully' });
//   } catch (error) {
//     console.error('Password change error:', error);
//     res.status(500).json({ message: 'Server error changing password' });
//   }
// });

// // === ADMIN PANEL PART: USER VERIFICATION ("ME") ROUTE ===
// // @route   GET /api/auth/me
// // @desc    Get logged in user's data to verify token
// // @access  Private
// router.get('/me', authMiddleware, async (req, res) => {
//     try {
//       // req.user is populated by your authMiddleware
//       const user = await User.findById(req.user.id).select('-password');
//       if (!user) {
//           return res.status(404).json({ message: 'User not found' });
//       }
//       res.json({ user });
//     } catch (err) {
//       console.error(err.message);
//       res.status(500).send('Server Error');
//     }
// });

// // === ADMIN PANEL PART: LOGOUT ROUTE ===
// // @route   POST /api/auth/logout
// // @desc    Logout user
// // @access  Public (or Private, depending on preference)
// router.post('/logout', (req, res) => {
//     // For JWT, logout is handled on the client-side by deleting the token.
//     // This server endpoint is here to complete the auth flow if needed.
//     res.json({ message: 'Logout successful' });
// });

// module.exports = router;
