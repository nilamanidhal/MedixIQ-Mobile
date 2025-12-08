const express = require('express');
const { body, validationResult } = require('express-validator');
const ContactQuery = require('../models/ContactQuery'); // Using the refactored model
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/contact/my-conversation
// @desc    Get the logged-in user's single conversation thread
// @access  Private
router.get('/my-conversation', authMiddleware, async (req, res) => {
  try {
    let conversation = await ContactQuery.findOne({ userId: req.user.id })
      .populate('messages.repliedBy', 'name'); // Get admin's name for replies

    if (!conversation) {
      // If no conversation exists, create a new one for this user
      conversation = new ContactQuery({ userId: req.user.id, messages: [] });
      await conversation.save();
    }
    
    res.json(conversation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/contact/send-message
// @desc    Submit a new message to the user's conversation
// @access  Private
router.post(
  '/send-message',
  [
    authMiddleware,
    body('message', 'Message is required').not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { message } = req.body;
      
      let conversation = await ContactQuery.findOne({ userId: req.user.id });
      
      // Ensure conversation exists (it should be created on first load, but as a fallback)
      if (!conversation) {
        conversation = new ContactQuery({ userId: req.user.id, messages: [] });
      }

      const newMessage = {
        from: 'User',
        text: message,
        repliedBy: req.user.id // The user is the one sending it
      };

      conversation.messages.push(newMessage);
      conversation.status = 'Open'; // Re-open the conversation on user reply
      await conversation.save();
      
      // Populate the new message
      const populatedConversation = await ContactQuery.findById(conversation._id)
        .populate('messages.repliedBy', 'name');

      res.status(201).json(populatedConversation);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

module.exports = router;







// const express = require('express');
// const { body, validationResult } = require('express-validator');
// const ContactQuery = require('../models/ContactQuery');
// const authMiddleware = require('../middleware/auth'); // Your existing user auth middleware

// const router = express.Router();

// // @route   POST /api/contact/submit
// // @desc    Submit a new contact query
// // @access  Private (for logged-in users)
// router.post(
//   '/submit',
//   [
//     authMiddleware, // Protect the route
//     body('subject', 'Subject is required').not().isEmpty(),
//     body('message', 'Message is required').not().isEmpty(),
//   ],
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array() });
//     }

//     try {
//       const { subject, message } = req.body;

//       const newQuery = new ContactQuery({
//         userId: req.user.id, // Get user ID from the auth token
//         subject,
//         message,
//       });

//       await newQuery.save();

//       res.status(201).json({ message: 'Your query has been submitted successfully! We will get back to you soon.' });
//     } catch (err) {
//       console.error(err.message);
//       res.status(500).send('Server Error');
//     }
//   }
// );

// // === THIS IS THE NEW ROUTE ===
// // @route   GET /api/contact/my-queries
// // @desc    Get all queries for the logged-in user
// // @access  Private
// router.get('/my-queries', authMiddleware, async (req, res) => {
//   try {
//     const queries = await ContactQuery.find({ userId: req.user.id }).sort({ createdAt: -1 });
//     res.json(queries);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server Error');
//   }
// });


// module.exports = router;
