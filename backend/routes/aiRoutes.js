const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const { askGemini, streamGemini } = require('../services/aiService');
const authMiddleware = require('../middleware/auth');
const Medicine = require('../models/Medicine');
const Log = require('../models/MedicineLog');
const ChatSession = require('../models/Chat');

const upload = multer({ storage: multer.memoryStorage() });

// ✅ Cloudinary Config (Make sure to add these to your .env file)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ✅ Helper to upload buffer to Cloudinary
const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            { folder: "medixiq_chats" },
            (error, result) => {
                if (result) { resolve(result.secure_url); }
                else { reject(error); }
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SESSION MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ✅ Get all sessions (sidebar list)
router.get('/sessions', authMiddleware, async (req, res) => {
    try {
        const sessions = await ChatSession.find({ userId: req.user._id })
            .select('title mode lastMessageAt isPinned createdAt')
            .sort({ isPinned: -1, lastMessageAt: -1 })
            .limit(30);
        res.json({ sessions });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// ✅ Create new session
router.post('/sessions', authMiddleware, async (req, res) => {
    try {
        const { mode = 'general', title } = req.body;
        const session = await ChatSession.create({
            userId: req.user._id,
            mode,
            title: title || getModeDefaultTitle(mode),
            messages: []
        });
        res.json({ session });
    } catch (e) {
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// ✅ Get single session messages
router.get('/sessions/:sessionId', authMiddleware, async (req, res) => {
    try {
        const session = await ChatSession.findOne({
            _id: req.params.sessionId,
            userId: req.user._id
        });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json({ session });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

// ✅ Delete session
router.delete('/sessions/:sessionId', authMiddleware, async (req, res) => {
    try {
        await ChatSession.findOneAndDelete({
            _id: req.params.sessionId,
            userId: req.user._id
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

// ✅ Pin/Unpin session
router.patch('/sessions/:sessionId/pin', authMiddleware, async (req, res) => {
    try {
        const session = await ChatSession.findOne({
            _id: req.params.sessionId,
            userId: req.user._id
        });
        if (!session) return res.status(404).json({ error: 'Not found' });
        session.isPinned = !session.isPinned;
        await session.save();
        res.json({ isPinned: session.isPinned });
    } catch (e) {
        res.status(500).json({ error: 'Failed to pin' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STREAMING CHAT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.post('/sessions/:sessionId/message', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { prompt, userLocalTime } = req.body;
        const imageFile = req.file;
        const userId = req.user._id;

        const session = await ChatSession.findOne({ _id: req.params.sessionId, userId });
        if (!session) return res.status(404).json({ error: 'Session not found' });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 1. Handle Cloudinary Upload FIRST if image exists
        let imageUrl = null;
        if (imageFile) {
            try {
                imageUrl = await uploadToCloudinary(imageFile.buffer);
            } catch (imgErr) {
                console.error("Cloudinary upload failed:", imgErr);
                // Continue anyway, but image won't be saved permanently
            }
        }

        // 2. Fetch context
        const [activeMeds, todayLogs] = await Promise.all([
            Medicine.find({ userId, isActive: true }).select('name dose times condition'),
            Log.find({ userId, date: { $gte: new Date().setHours(0,0,0,0) } }).populate('medicineId', 'name')
        ]);

        const contextData = {
            medicines: activeMeds.map(m => ({ name: m.name, dose: m.dose, schedule: m.times, condition: m.condition })),
            logs: todayLogs.map(l => ({ medicine: l.medicineId?.name, status: l.status, time: l.time })),
            profile: { name: req.user.name, age: req.user.age, gender: req.user.gender },
            currentTime: userLocalTime,
            mode: session.mode 
        };

        const historyForAI = session.messages.slice(-12).map(msg => ({ sender: msg.sender, text: msg.text }));

        // 3. Save user message to DB with the Cloudinary URL
        session.messages.push({
            sender: 'user',
            text: prompt || '[Image Upload]',
            image: imageUrl // ✅ Cloudinary URL saved here!
        });

        if (session.messages.length === 1 && session.title === getModeDefaultTitle(session.mode)) {
            session.title = prompt?.substring(0, 40) + (prompt?.length > 40 ? '...' : '') || getModeDefaultTitle(session.mode);
        }

        let fullResponse = '';

        // 4. Handle client disconnect (prevents Token Bleed!)
        req.on('close', () => {
            console.log("Client disconnected early. Stopping stream.");
            // Native Node streams will clean themselves up, but we log it to monitor.
        });

        await streamGemini(
            prompt, imageFile, historyForAI, contextData,
            (chunk) => {
                fullResponse += chunk;
                res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            }
        );

        session.messages.push({ sender: 'ai', text: fullResponse });
        session.lastMessageAt = new Date();
        await session.save();

        res.write(`data: ${JSON.stringify({ done: true, sessionId: session._id, title: session.title })}\n\n`);
        res.end();

    } catch (error) {
        console.error("Message Error:", error);
        res.write(`data: ${JSON.stringify({ error: true })}\n\n`);
        res.end();
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getModeDefaultTitle(mode) {
    const titles = {
        general: 'Health Chat',
        prescription: 'Prescription Analysis',
        report: 'Medical Report',
        medicine: 'Medicine Details'
    };
    return titles[mode] || 'New Chat';
}

module.exports = router;


















// const express = require('express');
// const router = express.Router();
// const multer = require('multer');
// const { askGemini } = require('../services/aiService');
// const authMiddleware = require('../middleware/auth');
// const Medicine = require('../models/Medicine');
// const Log = require('../models/MedicineLog');
// const Chat = require('../models/Chat'); // 👈 Import the new model

// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

// // ✅ 1. GET HISTORY (Load previous messages)
// router.get('/history', authMiddleware, async (req, res) => {
//     try {
//         const chats = await Chat.find({ userId: req.user._id })
//             .sort({ timestamp: 1 }) // Oldest first
//             .limit(50); // Limit to last 50 messages to save data
//         res.json(chats);
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to fetch history' });
//     }
// });

// // ✅ 2. CHAT QUERY (Save & Respond)
// router.post('/query', authMiddleware, upload.single('image'), async (req, res) => {
//     try {
//         const { prompt, userLocalTime } = req.body;
//         const imageFile = req.file;
//         const userId = req.user._id;

//         if (!prompt && !imageFile) {
//             return res.status(400).json({ error: 'Prompt required' });
//         }

//         // --- A. SAVE USER MESSAGE TO DB ---
//         await Chat.create({
//             userId,
//             sender: 'user',
//             text: prompt || '[Image Upload]',
//             // Note: Saving the actual image to DB is heavy. 
//             // Ideally, upload to Cloudinary and save URL. For now, we skip saving the image blob.
//         });

//         // --- B. FETCH CONTEXT (Meds + Logs) ---
//         const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
//         const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);

//         const [activeMeds, todayLogs, recentChats] = await Promise.all([
//             Medicine.find({ userId, isActive: true }).select('name dose times notes'),
//             Log.find({ userId, date: { $gte: startOfDay, $lte: endOfDay } }).populate('medicineId', 'name'),
//             // Fetch last 10 chats for AI Context Memory
//             Chat.find({ userId }).sort({ timestamp: -1 }).limit(10) 
//         ]);

//         // Format Context
//         const contextData = {
//             medicines: activeMeds.map(m => ({ name: m.name, dose: m.dose, schedule: m.times })),
//             logs: todayLogs.map(l => ({ medicine: l.medicineId?.name, status: l.status })),
//             profile: { name: req.user.name, allergies: req.user.allergies || [] },
//             currentTime: userLocalTime
//         };

//         // Format History for Gemini (Reverse back to chronological order)
//         const historyForAI = recentChats.reverse().map(chat => ({
//             sender: chat.sender,
//             text: chat.text
//         }));

//         // --- C. GET AI RESPONSE ---
//         const aiResponseText = await askGemini(prompt, imageFile, historyForAI, contextData);

//         // --- D. SAVE AI RESPONSE TO DB ---
//         await Chat.create({
//             userId,
//             sender: 'ai',
//             text: aiResponseText
//         });

//         res.json({ response: aiResponseText });

//     } catch (error) {
//         console.error("AI Route Error:", error);
//         res.status(500).json({ response: "Error processing request." });
//     }
// });

// module.exports = router;
