const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const CaregiverLink = require('../models/CaregiverLink');
const User = require('../models/User');
const Medicine = require('../models/Medicine');
const Log = require('../models/MedicineLog');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. GENERATE INVITE CODE (Patient does this)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/generate', authMiddleware, async (req, res) => {
    try {
        // Generate a random 6-digit code (e.g., "842915")
        const inviteCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Expires in 15 minutes
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const newLink = await CaregiverLink.create({
            patientId: req.user._id,
            inviteCode,
            expiresAt
        });

        res.json({ 
            message: 'Code generated', 
            inviteCode: newLink.inviteCode,
            expiresAt: newLink.expiresAt
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate code' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. LINK ACCOUNT (Caregiver does this)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/link', authMiddleware, async (req, res) => {
    try {
        const { inviteCode } = req.body;

        // Find the code
        const link = await CaregiverLink.findOne({ inviteCode, status: 'Pending' });

        if (!link) {
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }

        // Check if expired
        if (new Date() > link.expiresAt) {
            return res.status(400).json({ error: 'This code has expired. Please ask for a new one.' });
        }

        // Prevent linking to yourself
        if (link.patientId.toString() === req.user._id.toString()) {
            return res.status(400).json({ error: 'You cannot be your own caregiver.' });
        }

        // Check if they are already linked
        const existingLink = await CaregiverLink.findOne({
            patientId: link.patientId,
            caregiverId: req.user._id,
            status: 'Active'
        });

        if (existingLink) {
            return res.status(400).json({ error: 'You are already caring for this person.' });
        }

        // Success! Lock the link.
        link.caregiverId = req.user._id;
        link.status = 'Active';
        // We clear the code so it can NEVER be used again by anyone else
        link.inviteCode = `USED-${crypto.randomBytes(4).toString('hex')}`; 
        await link.save();

        const patient = await User.findById(link.patientId).select('name');

        res.json({ message: `Successfully linked to ${patient.name}!` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to link accounts' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. GET MY PATIENTS (Caregiver Dashboard)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/patients', authMiddleware, async (req, res) => {
    try {
        // Find all active links where logged-in user is the caregiver
        const links = await CaregiverLink.find({ 
            caregiverId: req.user._id, 
            status: 'Active' 
        }).populate('patientId', 'name age gender');

        // Format the response nicely
        const patients = links.map(link => ({
            linkId: link._id,
            patientId: link.patientId._id,
            name: link.patientId.name,
            age: link.patientId.age,
            gender: link.patientId.gender
        }));

        res.json(patients);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch patients' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. GET PATIENT LIVE DATA (Strictly Online)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/patient/:patientId/data', authMiddleware, async (req, res) => {
    try {
        const { patientId } = req.params;

        // SECURITY CHECK: Is this user actually allowed to see this patient's data?
        const isAuthorized = await CaregiverLink.findOne({
            patientId: patientId,
            caregiverId: req.user._id,
            status: 'Active'
        });

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Unauthorized access to patient data.' });
        }

        // Fetch live data directly from MongoDB
        const [medicines, logs] = await Promise.all([
            Medicine.find({ userId: patientId }),
            Log.find({ userId: patientId }).sort({ date: -1, time: -1 }).limit(50)
        ]);

        res.json({ medicines, logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch patient data' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. REMOVE LINK (Revoke Access)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.delete('/remove/:linkId', authMiddleware, async (req, res) => {
    try {
        // Either the patient or the caregiver can delete the link
        const link = await CaregiverLink.findOneAndDelete({
            _id: req.params.linkId,
            $or: [{ patientId: req.user._id }, { caregiverId: req.user._id }]
        });

        if (!link) {
            return res.status(404).json({ error: 'Link not found or unauthorized.' });
        }

        res.json({ message: 'Access revoked successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to revoke access' });
    }
});

module.exports = router;