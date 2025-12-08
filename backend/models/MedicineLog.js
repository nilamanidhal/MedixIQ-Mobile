const mongoose = require('mongoose');

const medicineLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
  date: { type: Date, required: true },  // scheduled date
  time: { type: String, required: true }, // scheduled time (HH:mm)
  status: { type: String, enum: ['pending', 'taken', 'missed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('MedicineLog', medicineLogSchema);
