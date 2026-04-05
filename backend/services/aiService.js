// backend/services/aiService.js

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// ✅ Initialize Gemini client
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ✅ Load factual OTC dataset
const otcPath = path.join(process.cwd(), "data/otcMedicines.json");
let factualData = {};

try {
  factualData = JSON.parse(fs.readFileSync(otcPath, "utf-8"));
  console.log("✅ Loaded OTC medicine data successfully!");
} catch (err) {
  console.error("⚠️ Failed to load otcMedicines.json:", err);
  factualData = { error: "Could not load factual data" };
}

/**
 * Helper: Convert buffer to Gemini inlineData format
 */
function bufferToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
}

/**
 * 🧠 NEW HELPER: Mode-Aware System Prompt Builder
 * This replaces your inline prompt and handles the 4 different AI modes.
 */
function buildSystemPrompt(medicines, logs, profile, currentTime, mode = 'general') {
    const medString = medicines?.length > 0 
        ? medicines.map(m => `• ${m.name} (${m.dose}) - ${m.condition || 'General'}`).join('\n')
        : "No active medications.";
        
    const logString = logs?.length > 0 
        ? logs.map(l => `• ${l.medicine}: ${l.status} at ${l.time}`).join('\n')
        : "No logs recorded for today yet.";

    const profileString = profile 
        ? `Name: ${profile.name || 'User'}, Age: ${profile.age || 'N/A'}, Gender: ${profile.gender || 'N/A'}`
        : "Unknown Profile";

    // 🎯 Mode-specific instructions
    const modeInstructions = {
        general: `You are a caring health assistant. Answer health questions warmly. Reference their specific medicines when relevant. For serious symptoms → advise doctor visit.`,
        
        prescription: `You are an expert at reading Indian prescriptions. When user uploads a prescription image:
1. List each medicine found.
2. Explain what condition it treats.
3. Explain dosage in simple terms.
4. Warn about any interactions with their existing active medicines: \n${medString}
5. Flag anything unusual or unclear.
Format response clearly with sections.`,
        
        report: `You are a medical report interpreter. When user uploads a report (blood test, X-ray, MRI, etc):
1. Identify the type of report.
2. Explain each parameter in simple language.
3. Highlight values that are outside normal range with ⚠️
4. Give a simple overall summary.
5. Suggest what to discuss with doctor.
DO NOT diagnose. Only explain and educate.`,
        
        medicine: `You are a pharmaceutical expert. When user asks about a medicine:
1. What it is used for.
2. How it works (in simple terms).
3. Common side effects.
4. Important warnings.
5. Check if it interacts with their current meds: \n${medString}
6. Provide Indian brand names if available.
Be comprehensive but easy to understand.`
    };

    return `You are MedixIQ AI — a highly skilled, context-aware healthcare assistant for ${profile?.name || 'the user'}.

### 👤 PATIENT PROFILE
- ${profileString}
- Current Time: ${currentTime}

### 💊 CURRENT MEDICINES
${medString}

### 📅 TODAY'S LOG
${logString}

### 🎯 YOUR TASK (Mode: ${mode.toUpperCase()})
${modeInstructions[mode] || modeInstructions.general}

### 🛡️ STRICT BEHAVIOR PROTOCOLS
1. **Personalization**: Match the user's language (Hindi/Odia/English). Use markdown formatting. Use emojis contextually.
2. **Interaction Safety**: Always cross-reference new medicine queries with the CURRENT MEDICINES list.
3. **Medical Triage**: URGENT (Chest pain, severe bleeding, breathing issues) → Tell them to "Call 112 immediately".
4. **Disclaimer**: ALWAYS end specific medical advice with: "**Disclaimer:** This information is for educational purposes only. Always consult a healthcare professional."

### 📚 FACTUAL OTC DATA REFERENCE
${JSON.stringify(factualData).substring(0, 1500)}
    `.trim();
}

/**
 * ⚡ NEW: Stream Gemini Response (For ChatGPT-style UI)
 */
export async function streamGemini(textPrompt, imageFile, history = [], contextData = {}, onChunk) {
    try {
        const { medicines, logs, profile, currentTime, mode } = contextData;
        const systemInstructionText = buildSystemPrompt(medicines, logs, profile, currentTime, mode);

        const formattedHistory = history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const currentParts = [{ text: textPrompt || "[Image Uploaded]" }];
        if (imageFile) {
            currentParts.push(bufferToGenerativePart(imageFile.buffer, imageFile.mimetype));
        }

        const result = await genAI.models.generateContentStream({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction: { parts: [{ text: systemInstructionText }] },
                generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }
            },
            contents: [
                ...formattedHistory,
                { role: 'user', parts: currentParts }
            ],
        });

        for await (const chunk of result) {
            // The new SDK usually places text directly on chunk.text
            const text = chunk.text || chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) onChunk(text);
        }
    } catch (error) {
        console.error("=== ❌ Stream error ===", error);
        onChunk("Sorry, I'm having trouble connecting to my medical database. Please try again.");
    }
}

/**
 * 🤖 Standard Ask Gemini (Used for background cron jobs / alerts)
 */
export async function askGemini(textPrompt, imageFile, history = [], contextData = {}) {
  try {
    console.log("🧠 Gemini Standard Service Started ===");
    const { medicines, logs, profile, currentTime, mode } = contextData;
    
    const systemInstructionText = buildSystemPrompt(medicines, logs, profile, currentTime, mode);

    const formattedHistory = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const currentParts = [{ text: textPrompt || "[Image Uploaded]" }];
    if (imageFile) {
      currentParts.push(bufferToGenerativePart(imageFile.buffer, imageFile.mimetype));
    }

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: { parts: [{ text: systemInstructionText }] },
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
      },
      contents: [
        ...formattedHistory,
        { role: 'user', parts: currentParts }
      ],
    });

    let textOutput =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      result?.candidates?.[0]?.content?.parts?.[0]?.text ||
      result?.text ||
      "I'm having trouble processing that right now.";

    return textOutput;

  } catch (error) {
    console.error("=== ❌ Error calling Gemini API ===", error);
    return "I apologize, but I'm having trouble connecting to my medical database at the moment. Please try again in a few seconds.";
  }
}















// // backend/services/aiService.js

// import dotenv from "dotenv";
// import fs from "fs";
// import path from "path";
// import { GoogleGenAI } from "@google/genai";

// dotenv.config();

// // ✅ Initialize Gemini client
// const genAI = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

// // ✅ Load factual OTC dataset (Keep this as a fallback/reference)
// const otcPath = path.join(process.cwd(), "data/otcMedicines.json");
// let factualData = {};

// try {
//   factualData = JSON.parse(fs.readFileSync(otcPath, "utf-8"));
//   console.log("✅ Loaded OTC medicine data successfully!");
// } catch (err) {
//   console.error("⚠️ Failed to load otcMedicines.json:", err);
//   factualData = { error: "Could not load factual data" };
// }

// /**
//  * Helper: Convert buffer to Gemini inlineData format
//  */
// function bufferToGenerativePart(buffer, mimeType) {
//   return {
//     inlineData: {
//       data: buffer.toString("base64"),
//       mimeType,
//     },
//   };
// }

// /**
//  * Ask Gemini with Context & History
//  * @param {string} textPrompt - The user's current question
//  * @param {object} imageFile - Optional image file (buffer & mimetype)
//  * @param {Array} history - Array of previous messages [{sender: 'user', text: '...'}, ...]
//  * @param {object} contextData - Object containing { medicines, logs, profile, currentTime }
//  */
// export async function askGemini(textPrompt, imageFile, history = [], contextData = {}) {
//   try {
//     // Use Flash model for speed and large context window
//     const modelName = "gemini-2.5-flash"; // Or "gemini-2.0-flash" / "gemini-1.5-flash"

//     console.log("🧠 Gemini Service Started ===");
//     console.log("User prompt:", textPrompt);

//     // --- 1. PREPARE CONTEXT STRINGS ---
//     // Safely convert context objects to strings for the prompt
//     const { medicines, logs, profile, currentTime } = contextData;
    
//     const medString = medicines && medicines.length > 0 
//         ? JSON.stringify(medicines, null, 2) 
//         : "No active medications.";
    
//     const logString = logs && logs.length > 0 
//         ? JSON.stringify(logs, null, 2) 
//         : "No logs recorded for today yet.";

//     const profileString = profile 
//         ? JSON.stringify(profile, null, 2) 
//         : "Unknown Profile";

//     // --- 2. CONSTRUCT SYSTEM INSTRUCTION ---
//     // This is the "Brain" of the AI for this session
//     const systemInstructionText = `
//       You are Med.AI, a highly skilled, safe, and context-aware healthcare assistant for the MedMind app.

//       ### 🕒 CURRENT STATUS
//       - **User's Local Time:** ${currentTime}

//       ### 👤 USER PROFILE (CRITICAL CONTEXT)
//       - **Profile:** ${profileString}
//       - **Active Prescriptions:** ${medString}
//       - **Today's Activity Log:** ${logString}

//       ### 🛡️ STRICT BEHAVIOR PROTOCOLS
//       1. **Interaction Safety Check:** - If the user asks about taking a *new* medicine (e.g., "Can I take Ibuprofen?"), **YOU MUST** cross-reference it with their [Active Prescriptions].
//          - Warn clearly about any potential drug interactions.
      
//       2. **Log Awareness:** - If the user asks "Did I take my meds?" or "What's next?", look at [Today's Activity Log] and [Active Prescriptions].
//          - If a log status is 'pending' and the time has passed, remind them gently.

//       3. **Profile Safety:** - If [User Profile] lists allergies (e.g., Peanuts) and the user uploads an image of food, analyze the image and warn them if the allergen might be present.

//       4. **Medical Triage Logic:**
//          - **URGENT:** If symptoms sound life-threatening (Chest pain, difficulty breathing, severe bleeding), advise to call Emergency Services immediately.
//          - **GENERAL:** For mild symptoms, provide general advice or OTC suggestions from the [Factual Data] below.

//       5. **Disclaimer:** - You are an AI, not a doctor. 
//          - **ALWAYS** end specific medical advice with: "**Disclaimer:** This information is for educational purposes only. Always consult a healthcare professional."

//       ### [Factual OTC Data Reference]
//       ${JSON.stringify(factualData)}
//     `;

//     // --- 3. FORMAT CHAT HISTORY ---
//     // Convert Frontend History -> Gemini History Format
//     // Frontend: [{ sender: 'user', text: '...' }, { sender: 'ai', text: '...' }]
//     // Gemini:   [{ role: 'user', parts: [...] }, { role: 'model', parts: [...] }]
//     const formattedHistory = history.map(msg => ({
//       role: msg.sender === 'user' ? 'user' : 'model',
//       parts: [{ text: msg.text }]
//     }));

//     // --- 4. PREPARE CURRENT MESSAGE ---
//     const currentParts = [{ text: textPrompt }];
    
//     // Add image if provided
//     if (imageFile) {
//       currentParts.push(bufferToGenerativePart(imageFile.buffer, imageFile.mimetype));
//     }

//     console.log("🚀 Sending request to Gemini...");

//     // --- 5. CALL GEMINI API ---
//     // We use generateContent with the full history + system config
//     const result = await genAI.models.generateContent({
//       model: modelName,
//       config: {
//         systemInstruction: {
//           parts: [{ text: systemInstructionText }]
//         },
//         generationConfig: {
//             maxOutputTokens: 1000,
//             temperature: 0.7, // Slightly creative but safe
//         }
//       },
//       contents: [
//         ...formattedHistory,               // Past conversation
//         { role: 'user', parts: currentParts } // Current message
//       ],
//     });

//     console.log("✅ Gemini response received!");

//     // --- 6. EXTRACT RESPONSE ---
//     let textOutput =
//       result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
//       result?.candidates?.[0]?.content?.parts?.[0]?.text ||
//       "⚠️ I'm having trouble processing that right now.";

//     console.log("🧠 Output length:", textOutput.length);
//     return textOutput;

//   } catch (error) {
//     console.error("=== ❌ Error calling Gemini API ===");
//     console.error(error);
//     return "I apologize, but I'm having trouble connecting to my medical database at the moment. Please try again in a few seconds.";
//   }
// }
