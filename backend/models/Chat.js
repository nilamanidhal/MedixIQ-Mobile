const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: String,
    enum: ['user', 'ai'], // Who sent the message?
    required: true
  },
  text: {
    type: String,
    required: true
  },
  image: {
    type: String, // URL if you upload to Cloudinary (optional)
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Chat', ChatSchema);