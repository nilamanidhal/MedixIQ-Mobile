import { useState, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL;

export const useDrugInteraction = () => {
    const [loading, setLoading] = useState(false);
    // ✅ Simple cache — same medicine not checked twice in same session
    const cacheRef = useRef({});

    const checkInteractions = async (newMedName, existingMedicinesList) => {
        if (!newMedName?.trim()) return null;

        // ✅ Offline check
        if (!navigator.onLine) {
            return { 
                status: 'ERROR', 
                message: 'You are offline. Drug safety check skipped.' 
            };
        }

        // ✅ Cache check — same medicine name returns cached result
        const cacheKey = `${newMedName.toLowerCase()}_${existingMedicinesList
            .filter(m => m.isActive && !m.isPaused)
            .map(m => m.name.toLowerCase())
            .sort()
            .join('_')}`;

        if (cacheRef.current[cacheKey]) {
            return cacheRef.current[cacheKey];
        }

        setLoading(true);

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(`${API_BASE_URL}/drug/check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    newMedName: newMedName.trim(),
                    existingMedicines: existingMedicinesList
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            // ✅ Cache the result
            cacheRef.current[cacheKey] = data;

            return data;

        } catch (error) {
            console.error('Drug interaction check failed:', error);

            // ✅ Retry once automatically
            try {
                await new Promise(r => setTimeout(r, 1500)); // wait 1.5s
                const token = localStorage.getItem('token');
                const retry = await fetch(`${API_BASE_URL}/drug/check`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        newMedName: newMedName.trim(),
                        existingMedicines: existingMedicinesList
                    })
                });
                if (retry.ok) {
                    const retryData = await retry.json();
                    cacheRef.current[cacheKey] = retryData;
                    return retryData;
                }
            } catch {
                // retry also failed
            }

            return { 
                status: 'ERROR', 
                message: 'Drug interaction service temporarily unavailable. Please consult your doctor.' 
            };

        } finally {
            setLoading(false);
        }
    };

    // ✅ Clear cache when needed (call after medicine added)
    const clearCache = () => {
        cacheRef.current = {};
    };

    return { checkInteractions, loading, clearCache };
};




















// import { useState } from 'react';
// import Groq from "groq-sdk";

// // Use environment variables! Do not hardcode this in production.
// const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY; 

// const groq = new Groq({
//     apiKey: GROQ_API_KEY,
//     dangerouslyAllowBrowser: true 
// });

// export const useDrugInteraction = () => {
//     const [loading, setLoading] = useState(false);

//     const searchMedicine = (query) => { return []; };

//     const checkInteractions = async (newMedName, existingMedicinesList) => {
//         // 🟢 PRE-CHECK: Is the user offline?
//         if (!navigator.onLine) {
//             return { status: "ERROR", message: "Offline: Cannot verify drug safety right now." };
//         }

//         setLoading(true);

//         try {
//             const today = new Date();
//             today.setHours(0, 0, 0, 0);

//             const existingNames = existingMedicinesList
//                 .filter(m => {
//                     if (!m.isActive || m.isPaused) return false;
//                     if (m.duration && m.duration.endDate) {
//                         const endDate = new Date(m.duration.endDate);
//                         if (endDate < today) return false;
//                     }
//                     return true;
//                 })
//                 .map(m => m.name);

//             if (existingNames.length === 0) {
//                 setLoading(false);
//                 return { status: "SAFE", message: "First medicine. No interactions." };
//             }

//             const prompt = `
//                 Act as a clinical drug interaction checker.
//                 Patient is currently taking: ${existingNames.join(", ")}.
//                 Patient is adding: ${newMedName}.
//                 Analyze for SEVERE or MAJOR interactions between "${newMedName}" and the existing list.
//                 Output MUST be valid JSON only. No markdown.
//                 If SAFE: { "status": "SAFE" }
//                 If DANGER:
//                 {
//                     "status": "DANGER",
//                     "drug1": "Name of the existing drug",
//                     "drug2": "${newMedName}",
//                     "severity": "High",
//                     "description": "Short, clear warning message."
//                 }
//             `;

//             const completion = await groq.chat.completions.create({
//                 messages: [{ role: "user", content: prompt }],
//                 model: "llama-3.3-70b-versatile", 
//                 temperature: 0, 
//             });

//             const rawResponse = completion.choices[0]?.message?.content || "";
//             const cleanJson = rawResponse.replace(/```json|```/g, "").trim();
            
//             let data;
//             try {
//                 data = JSON.parse(cleanJson);
//             } catch (e) {
//                 console.error("AI returned invalid JSON");
//                 return { status: "ERROR", message: "AI Analysis failed to process." };
//             }

//             if (data.status === "DANGER") {
//                 return { status: "DANGER", alert: data };
//             } else {
//                 return { status: "SAFE", message: "AI Analysis: Safe to take." };
//             }

//         } catch (error) {
//             console.error("❌ AI Check Failed:", error);
//             // 🟢 Explicitly return an error state if the API key is rejected or it crashes
//             return { status: "ERROR", message: "AI Service is temporarily unavailable." };
//         } finally {
//             setLoading(false);
//         }
//     };

//     return { suggestions: [], searchMedicine, checkInteractions, loading };
// };