const express = require('express');
const router = express.Router();
const multer = require('multer');
const { askGemini } = require('../services/aiService');
const authMiddleware = require('../middleware/authMiddleware');
const Medicine = require('../models/Medicine');
const Log = require('../models/MedicineLog');
const Chat = require('../models/Chat'); // 👈 Import the new model

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ✅ 1. GET HISTORY (Load previous messages)
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const chats = await Chat.find({ userId: req.user._id })
            .sort({ timestamp: 1 }) // Oldest first
            .limit(50); // Limit to last 50 messages to save data
        res.json(chats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// ✅ 2. CHAT QUERY (Save & Respond)
router.post('/query', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { prompt, userLocalTime } = req.body;
        const imageFile = req.file;
        const userId = req.user._id;

        if (!prompt && !imageFile) {
            return res.status(400).json({ error: 'Prompt required' });
        }

        // --- A. SAVE USER MESSAGE TO DB ---
        await Chat.create({
            userId,
            sender: 'user',
            text: prompt || '[Image Upload]',
            // Note: Saving the actual image to DB is heavy. 
            // Ideally, upload to Cloudinary and save URL. For now, we skip saving the image blob.
        });

        // --- B. FETCH CONTEXT (Meds + Logs) ---
        const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);

        const [activeMeds, todayLogs, recentChats] = await Promise.all([
            Medicine.find({ userId, isActive: true }).select('name dose times notes'),
            Log.find({ userId, date: { $gte: startOfDay, $lte: endOfDay } }).populate('medicineId', 'name'),
            // Fetch last 10 chats for AI Context Memory
            Chat.find({ userId }).sort({ timestamp: -1 }).limit(10) 
        ]);

        // Format Context
        const contextData = {
            medicines: activeMeds.map(m => ({ name: m.name, dose: m.dose, schedule: m.times })),
            logs: todayLogs.map(l => ({ medicine: l.medicineId?.name, status: l.status })),
            profile: { name: req.user.name, allergies: req.user.allergies || [] },
            currentTime: userLocalTime
        };

        // Format History for Gemini (Reverse back to chronological order)
        const historyForAI = recentChats.reverse().map(chat => ({
            sender: chat.sender,
            text: chat.text
        }));

        // --- C. GET AI RESPONSE ---
        const aiResponseText = await askGemini(prompt, imageFile, historyForAI, contextData);

        // --- D. SAVE AI RESPONSE TO DB ---
        await Chat.create({
            userId,
            sender: 'ai',
            text: aiResponseText
        });

        res.json({ response: aiResponseText });

    } catch (error) {
        console.error("AI Route Error:", error);
        res.status(500).json({ response: "Error processing request." });
    }
});

module.exports = router;







// // backend/routes/aiRoutes.js

// const express = require('express');
// const multer = require('multer');
// const router = express.Router();
// const { askGemini } = require('../services/aiService');

// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

// router.post('/query', upload.single('image'), async (req, res) => {
//   const { prompt } = req.body;
//   const imageFile = req.file;

//   if (!prompt) {
//     return res.status(400).json({ error: 'Prompt is required.' });
//   }

//   const aiResponse = await askGemini(prompt, imageFile);
//   res.json({ response: aiResponse });
// });

// module.exports = router;