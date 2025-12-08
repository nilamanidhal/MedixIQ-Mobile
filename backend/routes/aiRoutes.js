// backend/routes/aiRoutes.js

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { askGemini } = require('../services/aiService');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/query', upload.single('image'), async (req, res) => {
  const { prompt } = req.body;
  const imageFile = req.file;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const aiResponse = await askGemini(prompt, imageFile);
  res.json({ response: aiResponse });
});

module.exports = router;