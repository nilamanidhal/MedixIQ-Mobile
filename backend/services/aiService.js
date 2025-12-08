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
 * Convert buffer to Gemini inlineData format
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
 * Ask Gemini (text + optional image)
 */
export async function askGemini(textPrompt, imageFile) {
  try {
    const modelName = "gemini-2.5-flash-lite";
   // "gemini-2.0-flash";
    const parts = [];

    console.log("🧠 Gemini Service Started ===");
    console.log("User prompt:", textPrompt);

    // ✅ Add image (if exists)
    if (imageFile) {
      const imagePart = bufferToGenerativePart(imageFile.buffer, imageFile.mimetype);
      parts.push(imagePart);
    }

    // ✅ Build your safe instruction prompt
    const formattedPrompt = `
You are Med.AI, a highly skilled and safe healthcare information assistant.

Follow this strict logic for every query:
if user message is like GREETING "hi, hello, good morning" then replay as a healthcare assistant.

1. **Classify** the user's query as one of:
   - URGENT_MEDICAL_QUERY
   - SPECIFIC_DRUG_QUERY
   - GENERAL_HEALTH_QUERY

2. **Respond based on category**:
   - If URGENT_MEDICAL_QUERY:
     provide general precautions like "CPR for senceless after chest pain etc.." and at the end Reply with:
     "it is a general precaution. This sounds serious and needs immediate medical attention. Please visit an emergency room or call emergency services right away."
   - If SPECIFIC_DRUG_QUERY:
     Answer using the factual data from the [Factual Data] section and you can use outside data from trusted site.
   - If GENERAL_HEALTH_QUERY:
     Provide brief, general advice. For mild symptoms (e.g., mild cold, light fever, minor joint pain), suggest common OTC remedies from the dataset and basic care tips.
   - always provide genral medical treatment if the health is not serious.

3. **Formatting**:
   - Use Markdown headings (##)
   - Bold important terms
   - Use bullet points
   - Always end with disclamer only when you add medcine name in the response:
     **Disclaimer:** This information is for educational purposes only. Always consult a healthcare professional.

---

### [Factual Data]
${JSON.stringify(factualData, null, 2)}

---

Now respond to the user query below:
"${textPrompt}"
    `.trim();

    parts.push({ text: formattedPrompt });

    console.log("🚀 Sending request to Gemini model:", modelName);

    const result = await genAI.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user", // ✅ Only "user" role allowed in new API
          parts: parts,
        },
      ],
    });

    console.log("✅ Gemini response received!");

    // 🧩 Extract text properly
    let textOutput =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      result?.candidates?.[0]?.content?.parts?.[0]?.text ||
      result?.response?.text?.() ||
      "⚠️ No text returned.";

    console.log("🧠 Gemini Final Output ===");
    console.log(textOutput);

    return textOutput;
  } catch (error) {
    console.error("=== ❌ Error calling Gemini API ===");
    console.error(error);
    return "Sorry, I encountered an error while processing your request.";
  }
}











// // backend/services/aiService.js

// import dotenv from "dotenv";
// import { GoogleGenAI } from "@google/genai";

// dotenv.config();

// // Initialize Gemini client with API key
// const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// /**
//  * Convert buffer to Gemini's inlineData format
//  * @param {Buffer} buffer - Image buffer
//  * @param {string} mimeType - e.g. "image/png"
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
//  * Send text (and optional image) prompt to Gemini
//  * @param {string} textPrompt - User's text query
//  * @param {object} imageFile - Multer file object (optional)
//  * @returns {Promise<string>} - Gemini response text
//  */
// export async function askGemini(textPrompt, imageFile) {
//   try {
//     const modelName = "gemini-2.5-flash";
//     const parts = [];

//     console.log("=== Gemini Service Started ===");
//     console.log("Prompt text:", textPrompt);

//     // 🧠 Format the system + user prompt
//     const formattedPrompt = `
// You are Med.AI, a highly skilled and safe healthcare information assistant. Your task is to follow a strict three-step process for every user query.

// ---

// ### Step 1: Silently Classify the User's Query
// Classify the query into one of these three categories:

// 1. **URGENT_MEDICAL_QUERY:** Serious, time-sensitive symptoms (e.g., chest pain, difficulty breathing, confusion, high fever with chills).
// 2. **SPECIFIC_DRUG_QUERY:** Questions about a named medication (side effects, dosage, usage, etc.).
// 3. **GENERAL_HEALTH_QUERY:** Common, non-urgent wellness or mild symptom questions (e.g., mild cold, normal fever, light joint pain).

// ---

// ### Step 2: Act Based on the Classification

// - **If URGENT_MEDICAL_QUERY:**  
//   Respond ONLY with this message:  
//   > "I cannot provide medical advice. This sounds like a serious symptom that requires immediate medical attention. Please call your local emergency services or go to the nearest emergency room right away."

// - **If SPECIFIC_DRUG_QUERY:**  
//   Base your answer ONLY on factual data provided in the `[Factual Data]` section (if available).  
//   Do NOT generate or assume drug information not included there.

// - **If GENERAL_HEALTH_QUERY:**  
//   Provide a clear, supportive answer about general health management.  
//   For *mild and common symptoms only* (such as mild cold, low-grade fever, slight headache, or muscle/joint discomfort), you may:
//   - Suggest **common over-the-counter remedies** that are typically available without prescription.  
//   - Include **how and when** they are generally taken (e.g., “usually taken every 6–8 hours after meals”).  
//   - Encourage **hydration, rest, and lifestyle care**.
//   - Remind users to **consult a pharmacist or doctor** if symptoms persist or worsen.

// ---

// ### Step 3: Response Formatting Rules

// For non-urgent queries:

// - Use Markdown (`##`) for sections.
// - Use **bold** for important terms.
// - Use bullet points for lists.
// - Keep the response under **12 lines**.
// - NEVER provide a diagnosis or prescribe medication.
// - ALWAYS end with this exact line:

// > **Disclaimer:** This information is for educational purposes only. Always consult a healthcare professional for medical advice.


// Now respond to:
// ${textPrompt}
//     `.trim();

//     // Attach image if provided
//     if (imageFile) {
//       console.log("🖼️ Attaching image to Gemini request...");
//       console.log("Image mimetype:", imageFile.mimetype);
//       console.log("Image size (bytes):", imageFile.buffer.length);

//       const imagePart = bufferToGenerativePart(
//         imageFile.buffer,
//         imageFile.mimetype
//       );
//       parts.push(imagePart);
//     } else {
//       console.log("📝 Using Gemini model for text-only query...");
//     }

//     // Always include formatted text as final part
//     parts.push({ text: formattedPrompt });

//     console.log("Preparing request payload for Gemini API...");
//     console.log("Model:", modelName);
//     console.log("Parts length:", parts.length);

//     console.log("=== Gemini Request Payload ===");
//     console.log(
//       JSON.stringify(
//         {
//           model: modelName,
//           contents: [{ role: "user", parts }],
//         },
//         null,
//         2
//       )
//     );

//     // === Make Gemini API call ===
//     const result = await genAI.models.generateContent({
//       model: modelName,
//       contents: [{ role: "user", parts }],
//     });

//     console.log("=== Gemini Raw Result Structure ===");
//     console.log(JSON.stringify(result, null, 2));

//     // 🧩 Universal extraction logic
//     let textOutput = "";

//     try {
//       if (typeof result?.response?.text === "function") {
//         textOutput = result.response.text();
//       } else if (typeof result?.text === "function") {
//         textOutput = result.text();
//       } else if (
//         result?.response?.candidates?.[0]?.content?.parts?.[0]?.text
//       ) {
//         textOutput = result.response.candidates[0].content.parts[0].text;
//       } else if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
//         textOutput = result.candidates[0].content.parts[0].text;
//       } else {
//         console.warn("⚠️ No text field found in Gemini response structure.");
//         textOutput = "⚠️ No text returned from Gemini model.";
//       }
//     } catch (extractError) {
//       console.error("❌ Error while extracting Gemini response text:");
//       console.error(extractError);
//       textOutput = "⚠️ Failed to extract Gemini response text.";
//     }

//     console.log("=== Gemini Final Text Output ===");
//     console.log(textOutput);

//     console.log("=== Gemini Service Completed ===");
//     return textOutput;
//   } catch (error) {
//     console.error("=== Error calling Gemini API ===");
//     console.error(error);
//     return "Sorry, I encountered an error while processing your request.";
//   }
// }








// import dotenv from "dotenv";
// import { GoogleGenAI } from "@google/genai";

// dotenv.config();

// const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// function bufferToGenerativePart(buffer, mimeType) {
//   return {
//     inlineData: {
//       data: buffer.toString("base64"),
//       mimeType,
//     },
//   };
// }

// export async function askGemini(textPrompt, imageFile) {
//   try {
//     const modelName = "gemini-2.5-flash";
//     const parts = [];

//     console.log("=== Gemini Service Started ===");
//     console.log("Prompt text:", textPrompt);

//     if (imageFile) {
//       console.log("Attaching image to Gemini Flash model...");
//       console.log("Image mimetype:", imageFile.mimetype);
//       console.log("Image size (bytes):", imageFile.buffer.length);

//       const imagePart = bufferToGenerativePart(
//         imageFile.buffer,
//         imageFile.mimetype
//       );
//       parts.push(imagePart);
//     } else {
//       console.log("Using Gemini Flash model for text-only query...");
//     }

//     parts.push({ text: textPrompt });

//     console.log("Preparing request payload for Gemini API...");
//     console.log("Model name:", modelName);

//     // === Make API Call ===
//     const result = await genAI.models.generateContent({
//       model: modelName,
//       contents: [{ role: "user", parts }],
//     });

//     console.log("=== Gemini Raw Result Structure ===");
//     console.log(JSON.stringify(result, null, 2));

//     // 🧩 Universal extraction logic
//     let textOutput = "";

//     if (typeof result?.response?.text === "function") {
//       textOutput = result.response.text();
//     } else if (typeof result?.text === "function") {
//       textOutput = result.text();
//     } else if (
//       result?.response?.candidates?.[0]?.content?.parts?.[0]?.text
//     ) {
//       textOutput = result.response.candidates[0].content.parts[0].text;
//     } else if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
//       textOutput = result.candidates[0].content.parts[0].text;
//     } else {
//       textOutput = "No text returned from Gemini model.";
//     }

//     console.log("=== Gemini Final Text Output ===");
//     console.log(textOutput);

//     console.log("=== Gemini Service Completed ===");
//     return textOutput;
//   } catch (error) {
//     console.error("=== Error calling Gemini API ===");
//     console.error(error);
//     return "Sorry, I encountered an error while processing your request.";
//   }
// }
