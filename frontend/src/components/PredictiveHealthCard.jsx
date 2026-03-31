import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
    AlertTriangle, Sparkles, Activity, Lock, Send, 
    CheckCircle2, WifiOff 
} from "lucide-react";

const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Safe initialization
const ai = GEN_AI_KEY ? new GoogleGenAI({ apiKey: GEN_AI_KEY }) : null;

const PredictiveHealthCard = ({ medicines, stats }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0);
    const [userSymptom, setUserSymptom] = useState("");
    const [language, setLanguage] = useState('en');

    const analyzeRisk = async () => {
        // 1. OFFLINE CHECK
        if (!navigator.onLine) {
            setAnalysis({ 
                summary: language === 'hinglish' 
                    ? "Aap offline hain. AI analysis ke liye internet connect karein." 
                    : "You are offline. Please connect to the internet to use AI analysis.",
                details: [{"label": "Action", "text": "Check your WiFi or Mobile Data."}],
                type: "offline"
            });
            setStep(2);
            return;
        }

        if (!ai) {
            alert("API Key missing");
            return;
        }

        setLoading(true);
        try {
            // DATA PREP 
            // Handle differences in naming from backend
            const breakdown = stats.medicineBreakdown || stats.medicinePerformance || [];
            const problemMeds = breakdown.filter(m => m.adherence < 85);

            const allActiveMeds = medicines
                .filter(m => m.isActive && !m.isPaused)
                .map(m => ({
                    name: m.name,
                    condition: m.condition || "General Health",
                    dose: m.dose
                }));

            const missedData = problemMeds.map(pm => {
                const fullMed = medicines.find(m => m.name === pm.name);
                return {
                    name: pm.name,
                    condition: fullMed?.condition || "General Health",
                    adherence: `${pm.adherence}%`,
                };
            });

            // 🧠 IMPROVED PROMPT WITH MEDICAL INTELLIGENCE
            const prompt = `
You are Dr. MedixIQ, an AI health assistant specialized in medication adherence for Indian patients.

PATIENT DATA:
- Overall adherence: ${stats.adherenceRate}%
- Current streak: ${stats.currentStreak} days
- Worst performing medicines: ${JSON.stringify(missedData)}
- All active medicines: ${JSON.stringify(allActiveMeds)}
- Worst time of day for doses: ${stats.worstSlot || 'Unknown'}
- Worst day of week: ${stats.worstDay?.day || 'Unknown'}
- Patient reported symptom: "${userSymptom || 'None'}"
- Language: ${language === 'hinglish' ? 'Hinglish (Hindi words in English script)' : 'Simple English'}

ANALYSIS RULES:
1. If adherence < 70%: This is medically serious — warn about condition-specific risks.
2. If adherence 70-90%: Give specific improvement tips based on their worst time (${stats.worstSlot}) or day (${stats.worstDay?.day}).
3. If adherence > 90%: Celebrate but gently warn about not stopping medicines early.
4. ALWAYS connect missed medicines to their specific CONDITIONS (e.g., Telmikind = hypertension risk).
5. Give ONE specific actionable tip (e.g. "Set an extra alarm for ${stats.worstSlot}").
6. If the patient reported a symptom, correlate it with their missed medicines or potential side effects.

Return ONLY valid JSON (no markdown, no backticks):
{
    "summary": "2-3 sentences, spoken naturally like a caring doctor.",
    "details": [
        {"label": "Risk", "text": "Specific risk from missed medicine"},
        {"label": "Tip", "text": "One specific actionable advice"},
        {"label": "Pattern", "text": "Observation about their habit"}
    ],
    "type": "success" | "warning" | "alert" | "info"
}`;

            // ✅ CHANGED TO MORE RELIABLE FLASH MODEL
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt
            });

            const text = response.text.replace(/```json|```/g, '').trim();
            setAnalysis(JSON.parse(text));
            setStep(2);

        } catch (error) {
            console.error("AI Error", error);
            setAnalysis({ 
                summary: language === 'hinglish'
                    ? "Server busy hai. Kripya baad mein try karein."
                    : "Service busy. Please try again later.",
                details: [],
                type: "info"
            });
            setStep(2);
        } finally {
            setLoading(false);
        }
    };

    const getStyles = (type) => {
        switch(type) {
            case 'success':
                return { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-800', icon: <CheckCircle2 className="text-emerald-600" size={20} /> };
            case 'warning':
                return { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-900', icon: <AlertTriangle className="text-amber-600" size={20} /> };
            case 'alert':
                return { bg: 'bg-red-50 border-red-100', text: 'text-red-900', icon: <AlertTriangle className="text-red-600" size={20} /> };
            case 'offline':
                return { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700', icon: <WifiOff className="text-slate-500" size={20} /> };
            default:
                return { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-900', icon: <Sparkles className="text-blue-600" size={20} /> };
        }
    };

    if (step === 0) {
        return (
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 rounded-3xl shadow-lg text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={80} /></div>
                <div className="relative z-10">
                    <h3 className="font-bold text-lg">AI Health Predictor</h3>
                    <p className="text-indigo-100 text-sm mb-4">
                        Advanced analysis of your medicine habits & symptoms.
                    </p>
                    <button onClick={() => setStep(1)} className="bg-white text-indigo-600 px-4 py-2.5 rounded-xl font-bold flex gap-2 active:scale-95 transition-transform">
                        <Lock size={16} /> Check Health Status
                    </button>
                </div>
            </div>
        );
    }

    if (step === 1) {
        return (
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <textarea
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    rows="2"
                    placeholder={language === 'hinglish' ? "Jaise: Chakkar aa raha hai..." : "e.g. I feel dizzy..."}
                    value={userSymptom}
                    onChange={(e) => setUserSymptom(e.target.value)}
                />

                <button
                    onClick={analyzeRisk}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 active:scale-95 transition-transform disabled:opacity-70 disabled:active:scale-100"
                >
                    {loading ? <Activity className="animate-spin" size={16} /> : <Send size={16} />}
                    {loading ? "Analyzing Patterns..." : "Analyze"}
                </button>
            </div>
        );
    }

    const style = getStyles(analysis?.type);

    return (
        <div className={`p-5 rounded-3xl border ${style.bg}`}>
            <div className="flex justify-between mb-3">
                <div className="flex items-center gap-2">
                    {style.icon}
                    <h3 className={`font-bold ${style.text}`}>Analysis</h3>
                </div>
                <button onClick={() => setStep(0)} className="text-xs font-bold opacity-60">Close</button>
            </div>

            <p className={`text-sm mb-4 ${style.text}`}>{analysis?.summary}</p>

            {analysis?.details?.map((d, i) => (
                <div key={i} className="bg-white/60 p-3 rounded-xl mb-2 text-xs">
                    <span className="font-extrabold text-slate-700 mr-1">{d.label}:</span>
                    <span className="font-medium text-slate-600">{d.text}</span>
                </div>
            ))}
        </div>
    );
};

export default PredictiveHealthCard;

















// import React, { useState, useEffect } from 'react';
// import { GoogleGenAI } from "@google/genai";
// import { 
//     AlertTriangle, Sparkles, Activity, Lock, Send, 
//     CheckCircle2, Volume2, StopCircle, WifiOff 
// } from "lucide-react";

// const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// // ✅ Safe initialization (same intent as before)
// const ai = GEN_AI_KEY ? new GoogleGenAI({ apiKey: GEN_AI_KEY }) : null;

// const PredictiveHealthCard = ({ medicines, stats }) => {
//     const [analysis, setAnalysis] = useState(null);
//     const [loading, setLoading] = useState(false);
//     const [step, setStep] = useState(0);
//     const [userSymptom, setUserSymptom] = useState("");

//     // Language & Audio State
//     const [language, setLanguage] = useState('en');
//     const [isSpeaking, setIsSpeaking] = useState(false);

//     // 🛡️ SAFE SPEECH HELPER
//     const getSpeechSynth = () => {
//         if (typeof window !== 'undefined' && window.speechSynthesis) {
//             return window.speechSynthesis;
//         }
//         return null;
//     };

//     // --- AUDIO HANDLER ---
//     const speakText = (text) => {
//         const synth = getSpeechSynth();
//         if (!synth || !text) return;

//         synth.cancel();

//         if (isSpeaking) {
//             setIsSpeaking(false);
//             return;
//         }

//         if ('SpeechSynthesisUtterance' in window) {
//             const utterance = new SpeechSynthesisUtterance(text);
//             const voices = synth.getVoices();

//             if (language === 'hinglish') {
//                 const hindiVoice = voices.find(v => v.lang.includes('hi'));
//                 if (hindiVoice) utterance.voice = hindiVoice;
//             }

//             utterance.rate = 0.9;
//             utterance.onend = () => setIsSpeaking(false);
//             utterance.onerror = () => setIsSpeaking(false);

//             setIsSpeaking(true);
//             synth.speak(utterance);
//         }
//     };

//     useEffect(() => {
//         return () => {
//             const synth = getSpeechSynth();
//             if (synth) synth.cancel();
//         };
//     }, []);

//     const analyzeRisk = async () => {
//         // 1. OFFLINE CHECK
//         if (!navigator.onLine) {
//             setAnalysis({ 
//                 summary: language === 'hinglish' 
//                     ? "Aap offline hain. AI analysis ke liye internet connect karein." 
//                     : "You are offline. Please connect to the internet to use AI analysis.",
//                 details: [{ label: "Action", text: "Check your WiFi or Mobile Data." }],
//                 type: "offline"
//             });
//             setStep(2);
//             return;
//         }

//         if (!ai) {
//             alert("API Key missing");
//             return;
//         }

//         setLoading(true);
//         try {
//             // DATA PREP (unchanged)
//             const problemMeds = (stats.medicineBreakdown || []).filter(m => m.adherence < 85);

//             const allActiveMeds = medicines
//                 .filter(m => m.isActive && !m.isPaused)
//                 .map(m => ({
//                     name: m.name,
//                     condition: m.condition || "General Health",
//                     dose: m.dose
//                 }));

//             const missedData = problemMeds.map(pm => {
//                 const fullMed = medicines.find(m => m.name === pm.name);
//                 return {
//                     name: pm.name,
//                     condition: fullMed?.condition || "General Health",
//                     adherence: `${pm.adherence}%`,
//                 };
//             });

//             // PROMPT (unchanged)
//             const prompt = `
// Act as a highly experienced, empathetic Indian doctor (MBBS).

// CONTEXT:
// - Patient Language Preference: ${language === 'hinglish'
//                 ? "Hinglish (Hindi words written in English script)"
//                 : "Simple, clear English"}
// - Adherence: ${missedData.length === 0 ? "PERFECT (100%)" : "POOR (Missed Doses)"}
// - Missed Medicines: ${JSON.stringify(missedData)}
// - All Active Medicines: ${JSON.stringify(allActiveMeds)}
// - Patient Reported Feeling: "${userSymptom || "I feel fine/normal."}"

// TASK:
// Provide a realistic medical assessment.
// 1. Realism: Warn about condition-specific risks.
// 2. Correlation: Connect symptoms with missed medicine or side effects.
// 3. Tone: Professional but caring.

// Output strictly valid JSON:
// {
//     "summary": "1-2 sentence spoken-style summary for the patient.",
//     "details": [
//         {"label": "Insight", "text": "Specific medical fact or advice."}
//     ],
//     "type": "success" | "warning" | "info" | "alert"
// }
// `;

//             // ✅ NEW GEMINI CALL
//             const response = await ai.models.generateContent({
//                 model: "gemini-2.5-flash",
//                 contents: prompt
//             });

//             const text = response.text.replace(/```json|```/g, '').trim();
//             setAnalysis(JSON.parse(text));
//             setStep(2);

//         } catch (error) {
//             console.error("AI Error", error);
//             setAnalysis({ 
//                 summary: language === 'hinglish'
//                     ? "Server busy hai. Kripya baad mein try karein."
//                     : "Service busy. Please try again later.",
//                 details: [],
//                 type: "info"
//             });
//             setStep(2);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const getStyles = (type) => {
//         switch(type) {
//             case 'success':
//                 return { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-800', icon: <CheckCircle2 className="text-emerald-600" size={20} />, dot: 'bg-emerald-500' };
//             case 'warning':
//                 return { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-900', icon: <AlertTriangle className="text-amber-600" size={20} />, dot: 'bg-amber-500' };
//             case 'alert':
//                 return { bg: 'bg-red-50 border-red-100', text: 'text-red-900', icon: <AlertTriangle className="text-red-600" size={20} />, dot: 'bg-red-500' };
//             case 'offline':
//                 return { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700', icon: <WifiOff className="text-slate-500" size={20} />, dot: 'bg-slate-400' };
//             default:
//                 return { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-900', icon: <Sparkles className="text-blue-600" size={20} />, dot: 'bg-blue-500' };
//         }
//     };

//     /* ---------- UI STEPS (UNCHANGED) ---------- */

//     if (step === 0) {
//         return (
//             <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 rounded-3xl shadow-lg text-white mt-6 relative overflow-hidden">
//                 <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={80} /></div>
//                 <div className="relative z-10">
//                     <h3 className="font-bold text-lg">AI Health Predictor</h3>
//                     <p className="text-indigo-100 text-sm mb-4">
//                         Advanced analysis of your medicine habits & symptoms.
//                     </p>
//                     <button onClick={() => setStep(1)} className="bg-white text-indigo-600 px-4 py-2.5 rounded-xl font-bold flex gap-2">
//                         <Lock size={16} /> Check Health Status
//                     </button>
//                 </div>
//             </div>
//         );
//     }

//     if (step === 1) {
//         return (
//             <div className="bg-white p-5 rounded-3xl shadow-sm border mt-6">
//                 <textarea
//                     className="w-full bg-slate-50 rounded-xl p-3 text-sm mb-4 resize-none"
//                     rows="2"
//                     placeholder={language === 'hinglish'
//                         ? "Jaise: Chakkar aa raha hai..."
//                         : "e.g. I feel dizzy..."}
//                     value={userSymptom}
//                     onChange={(e) => setUserSymptom(e.target.value)}
//                 />

//                 <button
//                     onClick={analyzeRisk}
//                     disabled={loading}
//                     className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold flex justify-center gap-2"
//                 >
//                     {loading ? <Activity className="animate-spin" size={16} /> : <Send size={16} />}
//                     {loading ? "Analyzing..." : "Analyze"}
//                 </button>
//             </div>
//         );
//     }

//     const style = getStyles(analysis?.type);

//     return (
//         <div className={`p-5 rounded-3xl border mt-6 ${style.bg}`}>
//             <div className="flex justify-between mb-3">
//                 <div className="flex items-center gap-2">
//                     {style.icon}
//                     <h3 className={`font-bold ${style.text}`}>Analysis</h3>
//                 </div>
//                 <button onClick={() => setStep(0)} className="text-xs font-bold opacity-60">Close</button>
//             </div>

//             <p className={`text-sm mb-4 ${style.text}`}>{analysis?.summary}</p>

//             {analysis?.details?.map((d, i) => (
//                 <div key={i} className="bg-white/60 p-3 rounded-xl mb-2 text-xs font-bold">
//                     {d.text}
//                 </div>
//             ))}
//         </div>
//     );
// };

// export default PredictiveHealthCard;
