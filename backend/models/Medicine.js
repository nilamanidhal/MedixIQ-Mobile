const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Medicine name is required'],
    trim: true,
    maxlength: [100, 'Medicine name cannot exceed 100 characters']
  },
  dose: {
    type: String,
    required: [true, 'Dose is required'],
    trim: true,
    maxlength: [50, 'Dose cannot exceed 50 characters']
  },
  times: [{
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format']
  }],
  duration: {
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    trim: true
  },
 // ⭐ OFFLINE STABLE ID
  clientId: {
    type: String,
    index: true
  }
}, {
  timestamps: true
});

// Validate that end date is after start date
medicineSchema.pre('save', function(next) {
  if (this.duration.endDate <= this.duration.startDate) {
    return next(new Error('End date must be after start date'));
  }
  next();
});

module.exports = mongoose.model('Medicine', medicineSchema);