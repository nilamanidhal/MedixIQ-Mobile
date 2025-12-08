const express = require('express');
const webpush = require('web-push');
require('dotenv').config();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

console.log("SUBJECT:", process.env.VAPID_SUBJECT);
// Set VAPID details for web push
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Subscribe to push notifications
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
 console.log("📥 Received subscription:", req.body.subscription);

    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
       console.error("❌ Invalid subscription received:", subscription);
      return res.status(400).json({ message: 'Invalid subscription object' });
    }

    // Save subscription to user
    await User.findByIdAndUpdate(req.user._id, {
      subscription: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      }
    });
    console.log("✅ Subscription saved:", subscription); 

    res.json({ message: 'Subscription saved successfully' });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ message: 'Server error saving subscription' });
  }
});

// Send test notification
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.subscription) {
      return res.status(400).json({ message: 'User not subscribed to notifications' });
    }

    const payload = JSON.stringify({
      title: 'MedMind Test Notification',
      body: 'Your notification system is working correctly!',
      icon: 'https://medmind-heathcare.netlify.app/images/medicine.png',
      badge: 'https://medmind-heathcare.netlify.app/images/MedMindLogoBlank.png'
    });

    await webpush.sendNotification(user.subscription, payload);

    res.json({ message: 'Test notification sent successfully' });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ message: 'Server error sending test notification' });
  }
});

// Send medicine reminder notification
const sendMedicineReminder = async (userId, medicineName, dose) => {
  try {
    const user = await User.findById(userId);
    
    if (!user || !user.subscription) {
      console.log(`No subscription found for user ${userId}`);
      return;
    }

 console.log("🔔 Trying to send reminder. User subscription:", user.subscription);

    const payload = JSON.stringify({
      title: 'MedMind Reminder',
      body: `Time to take your ${medicineName} - ${dose}`,
      icon: 'https://medmind-heathcare.netlify.app/images/medicine.png',
      badge: 'https://medmind-heathcare.netlify.app/images/MedMindLogoBlank.png',
      data: {
        type: 'medicine-reminder',
        medicine: medicineName,
        dose: dose,
        timestamp: new Date().toISOString()
      }
    });

    await webpush.sendNotification(user.subscription, payload);
    console.log(`✅ Medicine reminder sent to user ${userId} for ${medicineName}`);
  } catch (error) {
    console.error('Error sending medicine reminder:', error);
  }
};


module.exports = router;  
module.exports.sendMedicineReminder = sendMedicineReminder;
