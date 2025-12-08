const mongoose = require('mongoose');

// This sub-document will store a single message
const messageSchema = new mongoose.Schema({
  from: {
    type: String,
    enum: ['User', 'Admin'],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  // This is the admin who sent the reply
  repliedBy: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
});

// This is the main schema. There will be only ONE document per user.
const contactQuerySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // This ensures one conversation thread per user
  },
  // All messages are now stored in this single array
  messages: [messageSchema], 
  status: {
    type: String,
    enum: ['Open', 'Answered', 'Closed'],
    default: 'Open',
  },
}, { timestamps: true }); // `updatedAt` will now track the last reply time

module.exports = mongoose.model('ContactQuery', contactQuerySchema);








// const mongoose = require('mongoose');

// const contactQuerySchema = new mongoose.Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User', // Links this query to a user
//     required: true,
//   },
//   subject: {
//     type: String,
//     required: true,
//     trim: true,
//   },
//   message: {
//     type: String,
//     required: true,
//   },
//   status: {
//     type: String,
//     enum: ['Open', 'Answered', 'Closed'],
//     default: 'Open',
//   },
//   replies: [{
//     from: {
//       type: String,
//       enum: ['Admin', 'User'],
//       required: true,
//     },
//     text: {
//       type: String,
//       required: true,
//     },
//     date: {
//       type: Date,
//       default: Date.now,
//     },
//     // === 1. ADDED THIS FIELD ===
//     // This links the reply to the specific admin who sent it.
//     repliedBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true,
//     },
//     // === 2. RENAMED THIS FIELD ===
//     // Renamed from 'date' to match your frontend code.
//     repliedAt: {
//       type: Date,
//       default: Date.now,
//     },
//   }],
// }, { timestamps: true });

// module.exports = mongoose.model('ContactQuery', contactQuerySchema);