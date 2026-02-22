const mongoose = require('mongoose');

// Sub-schemas for cleaner structure
const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: String,
  frequency: String,
  isPublic: { type: Boolean, default: true } // User controls visibility
}, { _id: false });

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  relation: String
}, { _id: false });

const emergencyProfileSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  token: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true // Indexed for fast public QR scanning
  },
  
  publicData: {
    name: String,
    age: Number,
    photo: String, // Cloudinary URL
    bloodGroup: { 
      type: String, 
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] 
    },
    allergies: [String],
    conditions: [String],
    medicines: [medicineSchema],
    emergencyContacts: [contactSchema],
    doctorName: String,
    doctorPhone: String
  },
  
  sentinelSettings: {
    enabled: { type: Boolean, default: false },
    sensitivityLevel: { 
      type: String, 
      enum: ['low', 'medium', 'high'], 
      default: 'medium' 
    },
    lastKnownLocation: {
      lat: Number,
      lng: Number,
      timestamp: Date
    }
  },
  
  tokenRegeneratedAt: { type: Date, default: Date.now }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('EmergencyProfile', emergencyProfileSchema);