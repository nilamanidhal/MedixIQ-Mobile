const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  category: { type: String, enum: ['Prescription', 'Lab Report', 'Invoice', 'Other'], default: 'Prescription' },
  
  // 🔄 CHANGED: Now storing an array of pages
  pages: [{
    imageUrl: String,
    cloudinaryId: String
  }],
  
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', ReportSchema);