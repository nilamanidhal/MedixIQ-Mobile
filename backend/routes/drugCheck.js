const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const authMiddleware = require('../middleware/auth');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY }); // ✅ Server-side only

router.post('/check', authMiddleware, async (req, res) => {
    const { newMedName, existingMedicines } = req.body;

    if (!newMedName || !existingMedicines) {
        return res.status(400).json({ status: 'ERROR', message: 'Missing data' });
    }

    // Filter active, non-expired medicines
    const today = new Date(); today.setHours(0,0,0,0);
    const existingNames = existingMedicines
        .filter(m => {
            if (!m.isActive || m.isPaused) return false;
            if (m.duration?.endDate && new Date(m.duration.endDate) < today) return false;
            return true;
        })
        .map(m => m.name);

    if (existingNames.length === 0) {
        return res.json({ status: 'SAFE', message: 'First medicine. No interactions.' });
    }

    const prompt = `
You are a clinical pharmacist specializing in Indian medicines.
Patient is currently taking: ${existingNames.join(', ')}.
Patient wants to add: "${newMedName}".

Instructions:
- Recognize Indian brand names (Dolo 650, Pan 40, Telmikind, Ecosprin, 
  Metformin SR, Atorva, Liv 52, Azithral, Augmentin, Calpol etc.)
- Check ALL pairs: "${newMedName}" vs each of [${existingNames.join(', ')}]
- Report SEVERE and MAJOR interactions only
- If multiple interactions found, return ALL of them

Output ONLY valid JSON. No markdown. No explanation outside JSON.

If ALL safe:
{ "status": "SAFE" }

If ONE interaction found:
{
  "status": "DANGER",
  "interactions": [
    {
      "drug1": "existing drug name",
      "drug2": "${newMedName}",
      "severity": "SEVERE" or "MAJOR",
      "description": "Clear warning in simple language. Max 2 sentences.",
      "recommendation": "What patient should do (e.g., consult doctor, avoid, take 2hr apart)"
    }
  ]
}

If MULTIPLE interactions found, return all in the interactions array.
`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
            max_tokens: 500,
        });

        const raw = completion.choices[0]?.message?.content || '';
        const clean = raw.replace(/```json|```/g, '').trim();

        let data;
        try {
            data = JSON.parse(clean);
        } catch {
            return res.json({ status: 'ERROR', message: 'AI analysis failed to process.' });
        }

        return res.json(data);

    } catch (error) {
        console.error('Drug check error:', error);
        return res.status(500).json({ 
            status: 'ERROR', 
            message: 'Drug interaction service temporarily unavailable.' 
        });
    }
});

module.exports = router;