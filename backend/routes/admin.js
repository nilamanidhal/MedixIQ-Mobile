const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const ContactQuery = require('../models/ContactQuery'); // Using the refactored model
const authAdmin = require('../middleware/authAdmin'); 
const Medicine = require('../models/Medicine');

const router = express.Router();

// @route   POST /api/admin/login
// @desc    Admin user login (No changes, this code is good)
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.isAdmin) return res.status(403).json({ message: 'Access Denied. Not an admin user.' });
    
    const payload = { userId: user.id };
    user.lastLogin = new Date();
    await user.save();

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' }, (err, token) => {
      if (err) throw err;
      const adminData = { id: user.id, name: user.name, isAdmin: user.isAdmin };
      res.json({ token, admin: adminData });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics (Updated to count conversations)
// @access  Private (Admin Only)
router.get('/stats', authAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const userFilter = { isAdmin: { $ne: true } };

    const totalUsers = await User.countDocuments(userFilter);
    const newUsersToday = await User.countDocuments({ ...userFilter, createdAt: { $gte: today } });
    const newUsersThisWeek = await User.countDocuments({ ...userFilter, createdAt: { $gte: sevenDaysAgo } });
    const activeUsers = await User.countDocuments({ ...userFilter, lastLogin: { $gte: oneDayAgo } }); 

    const userStats = { totalUsers, newUsersToday, activeUsers, newUsersThisWeek };

    // Updated query logic for stats
    const totalQueries = await ContactQuery.countDocuments({ "messages.0": { "$exists": true } }); // Count conversations with messages
    const openQueries = await ContactQuery.countDocuments({ status: 'Open', "messages.0": { "$exists": true } });
    const answeredQueries = await ContactQuery.countDocuments({ status: 'Answered' });
    const closedQueries = await ContactQuery.countDocuments({ status: 'Closed' });
    const newQueriesToday = await ContactQuery.countDocuments({ status: 'Open', createdAt: { $gte: today } });
    
    const queryStats = { totalQueries, openQueries, answeredQueries, closedQueries, newQueriesToday };

    res.json({ userStats, queryStats });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


// === REFACTORED CONVERSATION MANAGEMENT ROUTES ===

// @route   GET /api/admin/conversations
// @desc    Get all user conversations (replaces /queries)
// @access  Private (Admin Only)
router.get('/conversations', authAdmin, async (req, res) => {
  try {
    // Find all conversations that have at least one message
    const conversations = await ContactQuery.find({ "messages.0": { "$exists": true } })
      .populate('userId', 'name email') // Get the user's name and email
      .sort({ updatedAt: -1 }); // Show most recently active conversations first

    res.json(conversations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/admin/conversation/:userId
// @desc    Get a single conversation by USER ID (replaces /query/:id)
// @access  Private (Admin Only)
router.get('/conversation/:userId', authAdmin, async (req, res) => {
  try {
    const conversation = await ContactQuery.findOne({ userId: req.params.userId })
      .populate('userId', 'name email createdAt age gender')
      .populate('messages.repliedBy', 'name'); // Get name of admin/user for each message

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/admin/reply/:userId
// @desc    Reply to a conversation by USER ID (replaces /reply/:id)
// @access  Private (Admin Only)
router.post(
  '/reply/:userId',
  [
    authAdmin,
    body('message', 'Message is required').not().isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const conversation = await ContactQuery.findOne({ userId: req.params.userId });
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      const newReply = {
        from: 'Admin',
        text: req.body.message,
        repliedBy: req.user.id // The logged-in admin's ID
      };

      conversation.messages.push(newReply);
      conversation.status = 'Answered'; // Update status automatically
      await conversation.save();

      // Populate the newly added reply's author
      const populatedConversation = await ContactQuery.findById(conversation._id)
          .populate('userId', 'name email createdAt age gender')
          .populate('messages.repliedBy', 'name');

      res.json(populatedConversation);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT /api/admin/conversation/:userId/status
// @desc    Update a conversation's status (replaces /query/:id/status)
// @access  Private (Admin Only)
router.put('/conversation/:userId/status', authAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['Open', 'Answered', 'Closed'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const conversation = await ContactQuery.findOneAndUpdate(
      { userId: req.params.userId },
      { status: status },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// === NEW USER MANAGEMENT ROUTES ===

// @route   GET /api/admin/users
// @desc    Get all users with filtering & pagination
// @access  Private (Admin Only)
router.get('/users', authAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;

    const queryOptions = {
      isAdmin: { $ne: true } // Exclude other admins from the list
    };

    if (search) {
      queryOptions.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const users = await User.find(queryOptions)
      .select('-password') // Never send back the password
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalUsers = await User.countDocuments(queryOptions);

    res.json({
      users,
      pagination: {
        totalUsers,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / limit),
      },
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/admin/user/:id
// @desc    Delete a user account and all their data
// @access  Private (Admin Only)
router.delete('/user/:id', authAdmin, async (req, res) => {
  try {
    const userIdToDelete = req.params.id;

    // Security check: Find the user to be deleted
    const userToDelete = await User.findById(userIdToDelete);

    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Security check: Prevent an admin from deleting another admin
    if (userToDelete.isAdmin) {
      return res.status(403).json({ message: 'Cannot delete another admin account.' });
    }

    // Security check: Prevent an admin from deleting themselves
    if (req.user.id === userIdToDelete) {
      return res.status(403).json({ message: 'You cannot delete your own account.' });
    }

    // === Cascading Delete ===
    // 1. Delete user's medicines (This line will now work)
    await Medicine.deleteMany({ userId: userIdToDelete });
    // 2. Delete user's conversation thread
    await ContactQuery.deleteMany({ userId: userIdToDelete });
    // 3. Delete the user
    await User.findByIdAndDelete(userIdToDelete);

    res.json({ message: 'User and all associated data deleted successfully.' });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


module.exports = router;









// const express = require('express');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const User = require('../models/User');
// const ContactQuery = require('../models/ContactQuery');
// const authAdmin = require('../middleware/authAdmin'); 

// const router = express.Router();

// // @route   POST /api/admin/login
// // @desc    Admin user login
// // @access  Public
// router.post('/login', async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     if (!user.isAdmin) {
//       return res.status(403).json({ message: 'Access Denied. Not an admin user.' });
//     }
    
//     const payload = {
//       userId: user.id,
//     };

//     user.lastLogin = new Date();
//     await user.save();

//     jwt.sign(
//       payload,
//       process.env.JWT_SECRET,
//       { expiresIn: '8h' },
//       (err, token) => {
//         if (err) throw err;
//         const adminData = {
//           id: user.id,
//           name: user.name,
//           isAdmin: user.isAdmin,
//         };
//         res.json({ token, admin: adminData });
//       }
//     );

//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server Error');
//   }
// });


// // @route   GET /api/admin/stats
// // @desc    Get admin dashboard statistics
// // @access  Private (Admin Only)
// router.get('/stats', authAdmin, async (req, res) => {
//   try {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     const oneDayAgo = new Date();
//     oneDayAgo.setDate(oneDayAgo.getDate() - 1);

//     const sevenDaysAgo = new Date(today);
//     sevenDaysAgo.setDate(today.getDate() - 7);

//     const userFilter = { isAdmin: { $ne: true } };

//     const totalUsers = await User.countDocuments(userFilter);
//     const newUsersToday = await User.countDocuments({ ...userFilter, createdAt: { $gte: today } });
//     const newUsersThisWeek = await User.countDocuments({ ...userFilter, createdAt: { $gte: sevenDaysAgo } });
//     const activeUsers = await User.countDocuments({ ...userFilter, lastLogin: { $gte: oneDayAgo } }); 

//     const userStats = {
//       totalUsers,
//       newUsersToday,
//       activeUsers,
//       newUsersThisWeek
//     };

//     const totalQueries = await ContactQuery.countDocuments();
//     const openQueries = await ContactQuery.countDocuments({ status: 'Open' });
//     const answeredQueries = await ContactQuery.countDocuments({ status: 'Answered' });
//     const closedQueries = await ContactQuery.countDocuments({ status: 'Closed' });
//     const newQueriesToday = await ContactQuery.countDocuments({ createdAt: { $gte: today } });
    
//     const queryStats = {
//       totalQueries,
//       openQueries,
//       answeredQueries,
//       closedQueries,
//       newQueriesToday
//     };

//     res.json({ userStats, queryStats });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server Error');
//   }
// });


// // @route   GET /api/admin/queries
// // @desc    Get all user queries with filtering, sorting, and pagination
// // @access  Private (Admin Only)
// router.get('/queries', authAdmin, async (req, res) => {
//     try {
//       const { page = 1, limit = 10, search = '', status = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  
//       const queryOptions = {};
  
//       if (status) {
//         queryOptions.status = status;
//       }
  
//       if (search) {
//         queryOptions.$or = [
//           { subject: { $regex: search, $options: 'i' } },
//           { message: { $regex: search, $options: 'i' } }
//         ];
//       }
  
//       const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
  
//       const skip = (page - 1) * limit;
  
//       const queries = await ContactQuery.find(queryOptions)
//         .populate('userId', 'name email createdAt age gender') 
//         .sort(sortOptions)
//         .skip(skip)
//         .limit(parseInt(limit));
  
//       const totalQueries = await ContactQuery.countDocuments(queryOptions);
  
//       res.json({
//         queries,
//         pagination: {
//           totalQueries,
//           currentPage: parseInt(page),
//           totalPages: Math.ceil(totalQueries / limit),
//         },
//       });
  
//     } catch (err) {
//       console.error(err.message);
//       res.status(500).send('Server Error');
//     }
// });

// // === NEW: GET A SINGLE QUERY BY ID ===
// // @route   GET /api/admin/query/:id
// // @desc    Get a single query's details
// // @access  Private (Admin Only)
// router.get('/query/:id', authAdmin, async (req, res) => {
//   try {
//     const query = await ContactQuery.findById(req.params.id)
//       .populate('userId', 'name email createdAt age gender')
//       .populate('replies.repliedBy', 'name'); // Assuming admin who replies is a user

//     if (!query) {
//       return res.status(404).json({ message: 'Query not found' });
//     }
//     res.json({ query });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server Error');
//   }
// });

// // === NEW: REPLY TO A QUERY ===
// // @route   POST /api/admin/reply/:id
// // @desc    Add a reply to a query
// // @access  Private (Admin Only)
// router.post('/reply/:id', authAdmin, async (req, res) => {
//   const { message } = req.body;
//   if (!message) {
//     return res.status(400).json({ message: 'Reply message is required' });
//   }

//   try {
//     const query = await ContactQuery.findById(req.params.id);
//     if (!query) {
//       return res.status(404).json({ message: 'Query not found' });
//     }

//     const newReply = {
//       from: 'Admin',
//       text: message,
//       repliedBy: req.user.id // The logged-in admin's ID
//     };

//     query.replies.push(newReply);
//     query.status = 'Answered'; // Update status automatically
//     await query.save();

//     res.json(query);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server Error');
//   }
// });

// // === NEW: UPDATE QUERY STATUS ===
// // @route   PUT /api/admin/query/:id/status
// // @desc    Update a query's status
// // @access  Private (Admin Only)
// router.put('/query/:id/status', authAdmin, async (req, res) => {
//   const { status } = req.body;
//   if (!['Open', 'Answered', 'Closed'].includes(status)) {
//     return res.status(400).json({ message: 'Invalid status' });
//   }

//   try {
//     const query = await ContactQuery.findByIdAndUpdate(
//       req.params.id,
//       { status },
//       { new: true }
//     );

//     if (!query) {
//       return res.status(404).json({ message: 'Query not found' });
//     }
//     res.json(query);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server Error');
//   }
// });

// module.exports = router;
