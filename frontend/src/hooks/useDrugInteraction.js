import { useState } from 'react';
import Groq from "groq-sdk";

// 🔑 YOUR GROQ API KEY
const GROQ_API_KEY = "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"; 

const groq = new Groq({
    apiKey: GROQ_API_KEY,
    dangerouslyAllowBrowser: true 
});

export const useDrugInteraction = () => {
    const [loading, setLoading] = useState(false);

    const searchMedicine = (query) => { return []; };

    const checkInteractions = async (newMedName, existingMedicinesList) => {
        setLoading(true);

        try {
            // 🟢 STRICT FILTERING: Remove Paused, Inactive, AND Expired meds
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Ignore time, just compare dates

            const existingNames = existingMedicinesList
                .filter(m => {
                    if (!m.isActive || m.isPaused) return false; // Skip paused/deleted
                    
                    // Check Expiry
                    if (m.duration && m.duration.endDate) {
                        const endDate = new Date(m.duration.endDate);
                        if (endDate < today) return false; // Skip expired meds
                    }
                    return true;
                })
                .map(m => m.name);

            console.log(`📝 Checking: "${newMedName}" vs Active List: [${existingNames.join(", ")}]`);

            if (existingNames.length === 0) {
                setLoading(false);
                return null;
            }

            // 🟢 UPDATED PROMPT
            const prompt = `
                Act as a clinical drug interaction checker.
                
                Patient is currently taking: ${existingNames.join(", ")}.
                Patient is adding: ${newMedName}.
                
                Analyze for SEVERE or MAJOR interactions between "${newMedName}" and the existing list.
                
                Output MUST be valid JSON only. No markdown.
                
                If SAFE: { "status": "SAFE" }
                
                If DANGER:
                {
                    "status": "DANGER",
                    "drug1": "Name of the existing drug",
                    "drug2": "${newMedName}",
                    "severity": "High",
                    "description": "Short, clear warning message."
                }
            `;

            // 🟢 NEW MODEL ID (Llama 3.3 Versatile)
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.3-70b-versatile", 
                temperature: 0, 
            });

            const rawResponse = completion.choices[0]?.message?.content || "";
            console.log("🤖 GROQ RESPONSE:", rawResponse);

            const cleanJson = rawResponse.replace(/```json|```/g, "").trim();
            let data;
            
            try {
                data = JSON.parse(cleanJson);
            } catch (e) {
                console.error("AI returned invalid JSON");
                return null;
            }

            if (data.status === "DANGER") {
                return [data];
            } else {
                return null;
            }

        } catch (error) {
            console.error("❌ AI Check Failed:", error);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return { suggestions: [], searchMedicine, checkInteractions, loading };
};







// import { useState, useRef, useCallback } from 'react';
// import axios from 'axios';
// import { Network } from '@capacitor/network';
// import localMedicines from '../data/indianMedicines.json'; 

// export const useDrugInteraction = () => {
//     const [suggestions, setSuggestions] = useState([]);
//     const [loading, setLoading] = useState(false);
    
//     // Ref for debouncing to prevent spamming the API
//     const debounceRef = useRef(null);

//     const searchMedicine = useCallback(async (query) => {
//         if (!query || query.length < 2) {
//             setSuggestions([]);
//             return;
//         }

//         // Clear previous timer
//         if (debounceRef.current) clearTimeout(debounceRef.current);

//         // Set new timer (Debounce 500ms)
//         debounceRef.current = setTimeout(async () => {
//             console.log(`🚀 START Search for: "${query}"`); 
//             setLoading(true);

//             try {
//                 // -------------------------------------------
//                 // 1. LOCAL SEARCH (Instant & Offline)
//                 // -------------------------------------------
//                 const localMatches = localMedicines.filter(med => 
//                     med.name.toLowerCase().includes(query.toLowerCase()) || 
//                     med.generic.toLowerCase().includes(query.toLowerCase())
//                 );
//                 console.log(`📍 Local Found: ${localMatches.length}`);

//                 // -------------------------------------------
//                 // 2. ONLINE SEARCH (OpenFDA - No Proxy Needed)
//                 // -------------------------------------------
//                 let apiMatches = [];
//                 const status = await Network.getStatus();
                
//                 if (status.connected) {
//                     try {
//                         const searchQuery = query.toLowerCase();
                        
//                         // We search BOTH Brand Name AND Generic Name in parallel
//                         // We use fetch() because it is lighter than axios for this
                        
//                         const brandUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${searchQuery}*"&limit=5`;
//                         const genericUrl = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${searchQuery}*"&limit=5`;

//                         const [brandRes, genericRes] = await Promise.allSettled([
//                             fetch(brandUrl),
//                             fetch(genericUrl)
//                         ]);

//                         // PROCESS BRAND RESULTS
//                         if (brandRes.status === 'fulfilled' && brandRes.value.ok) {
//                             const data = await brandRes.value.json();
//                             const brands = processOpenFDAResults(data.results || []);
//                             apiMatches = [...apiMatches, ...brands];
//                         }

//                         // PROCESS GENERIC RESULTS
//                         if (genericRes.status === 'fulfilled' && genericRes.value.ok) {
//                             const data = await genericRes.value.json();
//                             const generics = processOpenFDAResults(data.results || []);
//                             apiMatches = [...apiMatches, ...generics];
//                         }
                        
//                         console.log(`🌐 API Found: ${apiMatches.length}`);

//                     } catch (err) {
//                         // OpenFDA throws 404 if nothing found, we ignore it silently
//                     }
//                 }

//                 // -------------------------------------------
//                 // 3. MERGE & DEDUPLICATE
//                 // -------------------------------------------
//                 const allResults = [...localMatches, ...apiMatches];
                
//                 // Use a Map to remove duplicates based on 'rxcui' ID
//                 // If ID is missing, we use the name as the key
//                 const uniqueResults = Array.from(new Map(allResults.map(item => [item.rxcui || item.name, item])).values());
                
//                 setSuggestions(uniqueResults);
                
//             } catch (error) {
//                 console.error("❌ Fatal Error in Search:", error);
//             } finally {
//                 setLoading(false);
//             }
//         }, 500); 

//     }, []);

//     // Helper to extract clean data from OpenFDA structure
//     const processOpenFDAResults = (results) => {
//         return results.map(item => {
//             // OpenFDA returns arrays, we take the first item
//             const brand = item.openfda?.brand_name?.[0];
//             const generic = item.openfda?.generic_name?.[0];
//             const rxcui = item.openfda?.rxcui?.[0]; // The ID we need

//             if (!rxcui) return null; // Skip if no ID found

//             return {
//                 name: brand || generic, // Prefer Brand name, fallback to Generic
//                 generic: generic || "Standard",
//                 rxcui: rxcui,
//                 source: 'Online'
//             };
//         }).filter(Boolean); // Remove nulls
//     };

//     // 2. CHECK INTERACTIONS (Unchanged)
//     const checkInteractions = async (newMedsRxCui, existingMedicinesList) => {
//         if (!newMedsRxCui) return null;
//         const status = await Network.getStatus();
//         if (!status.connected) return null;

//         const existingIds = existingMedicinesList
//             .filter(m => m.isActive && !m.isPaused && m.rxcui)
//             .map(m => m.rxcui);

//         if (existingIds.length === 0) return null;

//         const allIds = [newMedsRxCui, ...existingIds].join('+');
//         try {
//             // NIH Interaction API (Direct call usually works here)
//             const res = await axios.get(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${allIds}`);
//             if (res.data.fullInteractionTypeGroup) {
//                 const warnings = [];
//                 res.data.fullInteractionTypeGroup.forEach(group => {
//                     group.fullInteractionType.forEach(type => {
//                         type.interactionPair.forEach(pair => {
//                             warnings.push({
//                                 drug1: pair.interactionConcept[0].minConceptItem.name,
//                                 drug2: pair.interactionConcept[1].minConceptItem.name,
//                                 severity: type.severity,
//                                 description: pair.description,
//                                 existingMed: "Existing Med" 
//                             });
//                         });
//                     });
//                 });
//                 return warnings;
//             }
//             return null;
//         } catch (error) {
//             console.error("Interaction Check Failed", error);
//             return null;
//         }
//     };

//     return { suggestions, searchMedicine, checkInteractions, loading };
// };