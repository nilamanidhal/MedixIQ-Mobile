const mongoose = require('mongoose');

// ✅ Individual message
const MessageSchema = new mongoose.Schema({
    sender: { type: String, enum: ['user', 'ai'], required: true },
    text: { type: String, required: true },
    image: { type: String, default: null }, // Cloudinary URL
    timestamp: { type: Date, default: Date.now }
});

// ✅ Chat Session (like ChatGPT conversations)
const ChatSessionSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    title: { 
        type: String, 
        default: 'New Chat'
        // Auto-generated from first message
    },
    mode: {
        type: String,
        enum: ['general', 'prescription', 'report', 'medicine'],
        default: 'general'
    },
    messages: [MessageSchema],
    isPinned: { type: Boolean, default: false },
    lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ✅ Index
ChatSessionSchema.index({ userId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('ChatSession', ChatSessionSchema);















// const mongoose = require('mongoose');

// const ChatSchema = new mongoose.Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   sender: {
//     type: String,
//     enum: ['user', 'ai'], // Who sent the message?
//     required: true
//   },
//   text: {
//     type: String,
//     required: true
//   },
//   image: {
//     type: String, // URL if you upload to Cloudinary (optional)
//     default: null
//   },
//   timestamp: {
//     type: Date,
//     default: Date.now
//   }
// });

// module.exports = mongoose.model('Chat', ChatSchema);