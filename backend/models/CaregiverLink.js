const mongoose = require('mongoose');

const CaregiverLinkSchema = new mongoose.Schema({
    patientId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    caregiverId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null // Null until someone actually uses the code
    },
    inviteCode: { 
        type: String, 
        required: true,
        unique: true 
    },
    status: { 
        type: String, 
        enum: ['Pending', 'Active'], 
        default: 'Pending' 
    },
    expiresAt: { 
        type: Date, 
        required: true 
    }
}, { timestamps: true });

// Auto-delete documents that are still 'Pending' after they expire.
// This keeps your database clean from unused junk codes.
CaregiverLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { status: 'Pending' } });

module.exports = mongoose.model('CaregiverLink', CaregiverLinkSchema);