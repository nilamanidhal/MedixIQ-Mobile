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

// ✅ Load factual OTC dataset (Keep this as a fallback/reference)
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
 * Ask Gemini with Context & History
 * @param {string} textPrompt - The user's current question
 * @param {object} imageFile - Optional image file (buffer & mimetype)
 * @param {Array} history - Array of previous messages [{sender: 'user', text: '...'}, ...]
 * @param {object} contextData - Object containing { medicines, logs, profile, currentTime }
 */
export async function askGemini(textPrompt, imageFile, history = [], contextData = {}) {
  try {
    // Use Flash model for speed and large context window
    const modelName = "gemini-2.0-flash-lite-preview-02-05"; // Or "gemini-2.0-flash" / "gemini-1.5-flash"

    console.log("🧠 Gemini Service Started ===");
    console.log("User prompt:", textPrompt);

    // --- 1. PREPARE CONTEXT STRINGS ---
    // Safely convert context objects to strings for the prompt
    const { medicines, logs, profile, currentTime } = contextData;
    
    const medString = medicines && medicines.length > 0 
        ? JSON.stringify(medicines, null, 2) 
        : "No active medications.";
    
    const logString = logs && logs.length > 0 
        ? JSON.stringify(logs, null, 2) 
        : "No logs recorded for today yet.";

    const profileString = profile 
        ? JSON.stringify(profile, null, 2) 
        : "Unknown Profile";

    // --- 2. CONSTRUCT SYSTEM INSTRUCTION ---
    // This is the "Brain" of the AI for this session
    const systemInstructionText = `
      You are Med.AI, a highly skilled, safe, and context-aware healthcare assistant for the MedMind app.

      ### 🕒 CURRENT STATUS
      - **User's Local Time:** ${currentTime}

      ### 👤 USER PROFILE (CRITICAL CONTEXT)
      - **Profile:** ${profileString}
      - **Active Prescriptions:** ${medString}
      - **Today's Activity Log:** ${logString}

      ### 🛡️ STRICT BEHAVIOR PROTOCOLS
      1. **Interaction Safety Check:** - If the user asks about taking a *new* medicine (e.g., "Can I take Ibuprofen?"), **YOU MUST** cross-reference it with their [Active Prescriptions].
         - Warn clearly about any potential drug interactions.
      
      2. **Log Awareness:** - If the user asks "Did I take my meds?" or "What's next?", look at [Today's Activity Log] and [Active Prescriptions].
         - If a log status is 'pending' and the time has passed, remind them gently.

      3. **Profile Safety:** - If [User Profile] lists allergies (e.g., Peanuts) and the user uploads an image of food, analyze the image and warn them if the allergen might be present.

      4. **Medical Triage Logic:**
         - **URGENT:** If symptoms sound life-threatening (Chest pain, difficulty breathing, severe bleeding), advise to call Emergency Services immediately.
         - **GENERAL:** For mild symptoms, provide general advice or OTC suggestions from the [Factual Data] below.

      5. **Disclaimer:** - You are an AI, not a doctor. 
         - **ALWAYS** end specific medical advice with: "**Disclaimer:** This information is for educational purposes only. Always consult a healthcare professional."

      ### [Factual OTC Data Reference]
      ${JSON.stringify(factualData)}
    `;

    // --- 3. FORMAT CHAT HISTORY ---
    // Convert Frontend History -> Gemini History Format
    // Frontend: [{ sender: 'user', text: '...' }, { sender: 'ai', text: '...' }]
    // Gemini:   [{ role: 'user', parts: [...] }, { role: 'model', parts: [...] }]
    const formattedHistory = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // --- 4. PREPARE CURRENT MESSAGE ---
    const currentParts = [{ text: textPrompt }];
    
    // Add image if provided
    if (imageFile) {
      currentParts.push(bufferToGenerativePart(imageFile.buffer, imageFile.mimetype));
    }

    console.log("🚀 Sending request to Gemini...");

    // --- 5. CALL GEMINI API ---
    // We use generateContent with the full history + system config
    const result = await genAI.models.generateContent({
      model: modelName,
      config: {
        systemInstruction: {
          parts: [{ text: systemInstructionText }]
        },
        generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7, // Slightly creative but safe
        }
      },
      contents: [
        ...formattedHistory,               // Past conversation
        { role: 'user', parts: currentParts } // Current message
      ],
    });

    console.log("✅ Gemini response received!");

    // --- 6. EXTRACT RESPONSE ---
    let textOutput =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      result?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ I'm having trouble processing that right now.";

    console.log("🧠 Output length:", textOutput.length);
    return textOutput;

  } catch (error) {
    console.error("=== ❌ Error calling Gemini API ===");
    console.error(error);
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

// // ✅ Load factual OTC dataset
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
//  * Convert buffer to Gemini inlineData format
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
//  * Ask Gemini (text + optional image)
//  */
// export async function askGemini(textPrompt, imageFile) {
//   try {
//     const modelName = "gemini-2.5-flash-lite";
//    // "gemini-2.0-flash";
//     const parts = [];

//     console.log("🧠 Gemini Service Started ===");
//     console.log("User prompt:", textPrompt);

//     // ✅ Add image (if exists)
//     if (imageFile) {
//       const imagePart = bufferToGenerativePart(imageFile.buffer, imageFile.mimetype);
//       parts.push(imagePart);
//     }

//     // ✅ Build your safe instruction prompt
//     const formattedPrompt = `
// You are Med.AI, a highly skilled and safe healthcare information assistant.

// Follow this strict logic for every query:
// if user message is like GREETING "hi, hello, good morning" then replay as a healthcare assistant.

// 1. **Classify** the user's query as one of:
//    - URGENT_MEDICAL_QUERY
//    - SPECIFIC_DRUG_QUERY
//    - GENERAL_HEALTH_QUERY

// 2. **Respond based on category**:
//    - If URGENT_MEDICAL_QUERY:
//      provide general precautions like "CPR for senceless after chest pain etc.." and at the end Reply with:
//      "it is a general precaution. This sounds serious and needs immediate medical attention. Please visit an emergency room or call emergency services right away."
//    - If SPECIFIC_DRUG_QUERY:
//      Answer using the factual data from the [Factual Data] section and you can use outside data from trusted site.
//    - If GENERAL_HEALTH_QUERY:
//      Provide brief, general advice. For mild symptoms (e.g., mild cold, light fever, minor joint pain), suggest common OTC remedies from the dataset and basic care tips.
//    - always provide genral medical treatment if the health is not serious.

// 3. **Formatting**:
//    - Use Markdown headings (##)
//    - Bold important terms
//    - Use bullet points
//    - Always end with disclamer only when you add medcine name in the response:
//      **Disclaimer:** This information is for educational purposes only. Always consult a healthcare professional.

// ---

// ### [Factual Data]
// ${JSON.stringify(factualData, null, 2)}

// ---

// Now respond to the user query below:
// "${textPrompt}"
//     `.trim();

//     parts.push({ text: formattedPrompt });

//     console.log("🚀 Sending request to Gemini model:", modelName);

//     const result = await genAI.models.generateContent({
//       model: modelName,
//       contents: [
//         {
//           role: "user", // ✅ Only "user" role allowed in new API
//           parts: parts,
//         },
//       ],
//     });

//     console.log("✅ Gemini response received!");

//     // 🧩 Extract text properly
//     let textOutput =
//       result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
//       result?.candidates?.[0]?.content?.parts?.[0]?.text ||
//       result?.response?.text?.() ||
//       "⚠️ No text returned.";

//     console.log("🧠 Gemini Final Output ===");
//     console.log(textOutput);

//     return textOutput;
//   } catch (error) {
//     console.error("=== ❌ Error calling Gemini API ===");
//     console.error(error);
//     return "Sorry, I encountered an error while processing your request.";
//   }
// }

