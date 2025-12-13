const mongoose = require('mongoose');

const medicineLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
  // ⭐ OFFLINE LINK
  medicineClientId: {
    type: String,
    index: true
  },
  // ⭐ OFFLINE LOG ID
  clientLogId: {
    type: String,
    index: true
  },
  date: { type: Date, required: true },  // scheduled date
  time: { type: String, required: true }, // scheduled time (HH:mm)
  status: { type: String, enum: ['pending', 'taken', 'missed'], default: 'pending' },
  clientLogId: String,
medicineClientId: String
}, { timestamps: true });

module.exports = mongoose.model('MedicineLog', medicineLogSchema);
