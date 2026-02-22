const express = require('express');
const crypto = require('crypto');
const EmergencyProfile = require('../models/EmergencyProfile');
const authMiddleware = require('../middleware/auth'); // Adjust path if needed

const router = express.Router();

// Helper function to generate a secure 32-character hex token
const generateToken = () => crypto.randomBytes(16).toString('hex');

/* =========================================================
   PUBLIC ROUTE (NO AUTH REQUIRED) - FOR QR SCANNER
   ========================================================= */

// GET /emergency/:token -> Renders public emergency data
router.get('/emergency/:token', async (req, res) => {
  try {
    const profile = await EmergencyProfile.findOne({ token: req.params.token })
      .select('publicData updatedAt'); // Only return publicData and last updated time

    if (!profile) {
      return res.status(404).json({ message: 'Emergency profile not found or token invalid.' });
    }

    // Filter out private medicines before sending
    const safeData = profile.toObject();
    if (safeData.publicData && safeData.publicData.medicines) {
        safeData.publicData.medicines = safeData.publicData.medicines.filter(med => med.isPublic);
    }

    res.json({ profile: safeData });
  } catch (error) {
    console.error("Public Emergency Route Error:", error);
    res.status(500).json({ message: 'Server error retrieving emergency profile.' });
  }
});

/* =========================================================
   PROTECTED ROUTES (AUTH REQUIRED) - FOR APP USER
   ========================================================= */

// GET /api/emergency/profile -> Get my profile
router.get('/api/emergency/profile', authMiddleware, async (req, res) => {
  try {
    const profile = await EmergencyProfile.findOne({ userId: req.user._id });
    if (!profile) return res.status(404).json({ message: 'Profile not setup yet.' });
    res.json({ profile });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile.' });
  }
});

// POST /api/emergency/setup -> Create initial profile
router.post('/api/emergency/setup', authMiddleware, async (req, res) => {
  try {
    const existing = await EmergencyProfile.findOne({ userId: req.user._id });
    if (existing) return res.status(400).json({ message: 'Profile already exists. Use update.' });

    const newProfile = new EmergencyProfile({
      userId: req.user._id,
      token: generateToken(),
      publicData: req.body.publicData,
      sentinelSettings: req.body.sentinelSettings || {}
    });

    await newProfile.save();
    res.status(201).json({ profile: newProfile, message: 'Emergency profile created.' });
  } catch (error) {
    console.error("Setup Error:", error);
    res.status(500).json({ message: 'Error setting up emergency profile.' });
  }
});

// PUT /api/emergency/update -> Update existing profile
router.put('/api/emergency/update', authMiddleware, async (req, res) => {
  try {
    const profile = await EmergencyProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { publicData: req.body.publicData } },
      { new: true }
    );

    if (!profile) return res.status(404).json({ message: 'Profile not found.' });
    res.json({ profile, message: 'Profile updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile.' });
  }
});

// POST /api/emergency/regenerate -> Generate new token (invalidates old QR)
router.post('/api/emergency/regenerate', authMiddleware, async (req, res) => {
  try {
    const newToken = generateToken();
    const profile = await EmergencyProfile.findOneAndUpdate(
      { userId: req.user._id },
      { 
        $set: { 
            token: newToken, 
            tokenRegeneratedAt: Date.now() 
        } 
      },
      { new: true }
    );

    if (!profile) return res.status(404).json({ message: 'Profile not found.' });
    res.json({ token: profile.token, message: 'Token regenerated successfully. Old QR codes are now invalid.' });
  } catch (error) {
    res.status(500).json({ message: 'Error regenerating token.' });
  }
});

// GET /api/emergency/qr -> Get current QR token
router.get('/api/emergency/qr', authMiddleware, async (req, res) => {
  try {
    const profile = await EmergencyProfile.findOne({ userId: req.user._id }).select('token');
    if (!profile) return res.status(404).json({ message: 'Profile not found.' });
    res.json({ token: profile.token });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching QR token.' });
  }
});

// PUT /api/emergency/sentinel -> Toggle/Update sentinel settings
router.put('/api/emergency/sentinel', authMiddleware, async (req, res) => {
  try {
    const profile = await EmergencyProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { "sentinelSettings.enabled": req.body.enabled, "sentinelSettings.sensitivityLevel": req.body.sensitivityLevel } },
      { new: true }
    );
    if (!profile) return res.status(404).json({ message: 'Profile not found.' });
    res.json({ sentinelSettings: profile.sentinelSettings });
  } catch (error) {
    res.status(500).json({ message: 'Error updating Sentinel settings.' });
  }
});

// PUT /api/emergency/location -> Update cached location from Sentinel Mode
router.put('/api/emergency/location', authMiddleware, async (req, res) => {
  try {
    const { lat, lng, timestamp } = req.body;
    await EmergencyProfile.updateOne(
      { userId: req.user._id },
      { $set: { "sentinelSettings.lastKnownLocation": { lat, lng, timestamp: new Date(timestamp) } } }
    );
    res.json({ message: 'Location cached successfully.' });
  } catch (error) {
    // Keep silent on failure to avoid spamming the foreground service logs
    res.status(500).json({ message: 'Error caching location.' });
  }
});

module.exports = router;