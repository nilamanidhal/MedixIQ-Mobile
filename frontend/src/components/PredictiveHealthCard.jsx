import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AlertTriangle, Sparkles, Activity, Lock, Send, CheckCircle2 } from "lucide-react";

const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const ai = new GoogleGenAI({
    apiKey: GEN_AI_KEY
});

const PredictiveHealthCard = ({ medicines, stats }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0);
    const [userSymptom, setUserSymptom] = useState("");

    const analyzeRisk = async () => {
        setLoading(true);
        try {
            // 1. Separate Missed vs Taken Meds
            const problemMeds = (stats.medicineBreakdown || []).filter(m => m.adherence < 85);

            const allActiveMeds = medicines
                .filter(m => m.isActive && !m.isPaused)
                .map(m => ({
                    name: m.name,
                    condition: m.condition || "General Health",
                }));

            const missedData = problemMeds.map(pm => {
                const fullMed = medicines.find(m => m.name === pm.name);
                return {
                    name: pm.name,
                    condition: fullMed?.condition || "General Health",
                    adherence: `${pm.adherence}%`,
                };
            });

            // 2. Prompt
            const prompt = `
Act as a highly intelligent medical health forecaster.

CONTEXT:
- Adherence: ${missedData.length === 0 ? "PERFECT (100%)" : "POOR (Missed Doses)"}
- Missed Medicines: ${JSON.stringify(missedData)}
- All Active Medicines: ${JSON.stringify(allActiveMeds)}
- User Says: "${userSymptom || "I feel fine."}"

TASK: Analyze the intersection of Adherence + User Feeling.

SCENARIO 1: PERFECT Adherence + User feels GOOD:
- Response: "Excellent! Your condition is likely under control. Keep maintaining this routine for long-term stability."
- Type: "success"

SCENARIO 2: POOR Adherence + User feels GOOD:
- Response: "WARNING: You feel fine now, but skipping [Medicine] creates a 'Silent Risk'. You might face [Specific Risk] in the future if this continues."
- Type: "warning"

SCENARIO 3: PERFECT Adherence + User feels BAD:
- Response: "Since you took your meds, this might be a side effect of [Medicine] or an external factor like diet/sleep."
- Type: "info"

SCENARIO 4: POOR Adherence + User feels BAD:
- Response: "Your symptoms are likely caused by missing your [Medicine]. Please take it as soon as possible."
- Type: "alert"

Output strictly valid JSON:
{
    "summary": "1-2 sentence intelligent analysis.",
    "details": [
        {"label": "Insight", "text": "Specific prediction or advice."}
    ],
    "type": "success" | "warning" | "info" | "alert"
}
`;

            // ✅ Modern Gemini Call
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
                summary: "Service busy. Please rely on your doctor's advice.",
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
                return {
                    bg: 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100',
                    text: 'text-emerald-800',
                    icon: <CheckCircle2 className="text-emerald-600" size={20} />,
                    dot: 'bg-emerald-500'
                };
            case 'warning':
                return {
                    bg: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100',
                    text: 'text-amber-900',
                    icon: <AlertTriangle className="text-amber-600" size={20} />,
                    dot: 'bg-amber-500'
                };
            case 'alert':
                return {
                    bg: 'bg-gradient-to-br from-red-50 to-rose-50 border-red-100',
                    text: 'text-red-900',
                    icon: <AlertTriangle className="text-red-600" size={20} />,
                    dot: 'bg-red-500'
                };
            default:
                return {
                    bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100',
                    text: 'text-blue-900',
                    icon: <Sparkles className="text-blue-600" size={20} />,
                    dot: 'bg-blue-500'
                };
        }
    };

    // STEP 0
    if (step === 0) {
        return (
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 rounded-3xl shadow-lg text-white mt-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles size={80} />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={20} className="text-yellow-300" />
                        <h3 className="font-bold text-lg">AI Health Predictor</h3>
                    </div>

                    <p className="text-indigo-100 text-sm mb-4">
                        How are you feeling? Let AI analyze your health trends.
                    </p>

                    <button
                        onClick={() => setStep(1)}
                        className="bg-white text-indigo-600 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
                    >
                        <Lock size={16} /> Check Health Status
                    </button>
                </div>
            </div>
        );
    }

    // STEP 1
    if (step === 1) {
        return (
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 mt-6">
                <h3 className="font-bold text-slate-800 text-lg mb-2">
                    How do you feel today?
                </h3>

                <textarea
                    className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none border mb-4 resize-none"
                    rows="2"
                    placeholder="e.g. I feel great! / I have a mild headache..."
                    value={userSymptom}
                    onChange={(e) => setUserSymptom(e.target.value)}
                />

                <div className="flex gap-3">
                    <button
                        onClick={() => setStep(0)}
                        className="px-4 py-2 text-slate-400 font-bold text-sm"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={analyzeRisk}
                        disabled={loading}
                        className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    >
                        {loading
                            ? <Activity className="animate-spin" size={16} />
                            : <Send size={16} />
                        }

                        {loading ? "Analyzing..." : "Analyze"}
                    </button>
                </div>
            </div>
        );
    }

    const style = getStyles(analysis?.type);

    // STEP 2
    return (
        <div className={`p-5 rounded-3xl border shadow-sm mt-6 ${style.bg}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {style.icon}
                    <h3 className={`font-bold ${style.text}`}>
                        {analysis?.type === 'success'
                            ? 'Health Forecast'
                            : 'Risk Analysis'}
                    </h3>
                </div>

                <button
                    onClick={() => setStep(0)}
                    className="text-xs opacity-60 font-bold"
                >
                    Close
                </button>
            </div>

            <p className={`text-sm mb-4 font-medium ${style.text}`}>
                {analysis?.summary}
            </p>

            <div className="space-y-2">
                {analysis?.details?.map((detail, idx) => (
                    <div key={idx} className="bg-white/60 p-3 rounded-xl flex items-start gap-3 border border-white/40">
                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        <span className={`text-xs font-bold ${style.text}`}>
                            {detail.text}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PredictiveHealthCard;

















// import React, { useState } from 'react';
// import { GoogleGenAI } from "@google/genai";
// import { AlertTriangle, Sparkles, Activity, Lock, Send } from "lucide-react";

// const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// const ai = new GoogleGenAI({
//     apiKey: GEN_AI_KEY
// });

// const PredictiveHealthCard = ({ medicines, stats }) => {
//     const [analysis, setAnalysis] = useState(null);
//     const [loading, setLoading] = useState(false);
//     const [step, setStep] = useState(0);
//     const [userSymptom, setUserSymptom] = useState("");

//     const analyzeRisk = async () => {
//         setLoading(true);
//         try {
//             // 1. Identify Problem Meds
//             const problemMeds = (stats.medicineBreakdown || []).filter(m => m.adherence < 85);

//             if (problemMeds.length === 0 && !userSymptom.trim()) {
//                 setAnalysis({
//                     summary: "Adherence is perfect and no symptoms reported. Keep it up!",
//                     risks: []
//                 });
//                 setStep(2);
//                 return;
//             }

//             // 2. Prepare Context
//             const enrichedData = problemMeds.map(pm => {
//                 const fullMed = medicines.find(m => m.name === pm.name);
//                 return {
//                     name: pm.name,
//                     condition: fullMed?.condition || "General Health",
//                     adherence: `${pm.adherence}%`
//                 };
//             });

//             // 3. Prompt
//             const prompt = `
// Act as a medical risk analyst.

// CONTEXT:
// - Medicines Missed: ${JSON.stringify(enrichedData)}
// - User Reported Feeling: "${userSymptom || "User did not report specific symptoms."}"

// TASK:
// Analyze correlation between missed medicines and user feeling.

// Output strictly valid JSON:
// {
//     "summary": "Direct 1 sentence analysis",
//     "risks": [
//         {"med": "Medicine Name (or 'General')", "risk": "Specific insight"}
//     ]
// }
// `;

//             // ✅ Modern Gemini Call
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
//                 summary: "Could not generate analysis. Please try again.",
//                 risks: []
//             });

//             setStep(2);
//         } finally {
//             setLoading(false);
//         }
//     };

//     // ---------- STEP 0 ----------
//     if (step === 0) {
//         return (
//             <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 rounded-3xl shadow-lg text-white mt-6 relative overflow-hidden">
//                 <div className="absolute top-0 right-0 p-4 opacity-10">
//                     <Sparkles size={80} />
//                 </div>

//                 <div className="relative z-10">
//                     <div className="flex items-center gap-2 mb-2">
//                         <Sparkles size={20} className="text-yellow-300" />
//                         <h3 className="font-bold text-lg">AI Health Predictor</h3>
//                     </div>

//                     <p className="text-indigo-100 text-sm mb-4">
//                         Missed some doses? See how it might affect you.
//                     </p>

//                     <button
//                         onClick={() => setStep(1)}
//                         className="bg-white text-indigo-600 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
//                     >
//                         <Lock size={16} /> Unlock Insights
//                     </button>
//                 </div>
//             </div>
//         );
//     }

//     // ---------- STEP 1 ----------
//     if (step === 1) {
//         return (
//             <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 mt-6">
//                 <h3 className="font-bold text-slate-800 text-lg mb-2">
//                     Quick Check-in
//                 </h3>

//                 <p className="text-sm text-slate-500 mb-4">
//                     Do you feel any different today? (Optional)
//                 </p>

//                 <textarea
//                     className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none border mb-4 resize-none"
//                     rows="2"
//                     placeholder="e.g. I feel dizzy..."
//                     value={userSymptom}
//                     onChange={(e) => setUserSymptom(e.target.value)}
//                 />

//                 <div className="flex gap-3">
//                     <button
//                         onClick={() => setStep(0)}
//                         className="px-4 py-2 text-slate-400 font-bold text-sm"
//                     >
//                         Cancel
//                     </button>

//                     <button
//                         onClick={analyzeRisk}
//                         disabled={loading}
//                         className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
//                     >
//                         {loading
//                             ? <Activity className="animate-spin" size={16} />
//                             : <Send size={16} />
//                         }

//                         {loading ? "Analyzing..." : "Analyze Now"}
//                     </button>
//                 </div>
//             </div>
//         );
//     }

//     // ---------- STEP 2 ----------
//     return (
//         <div className="bg-gradient-to-br from-orange-50 to-red-50 p-5 rounded-3xl border border-orange-100 shadow-sm mt-6">
//             <div className="flex items-center justify-between mb-3">
//                 <div className="flex items-center gap-2">
//                     <AlertTriangle className="text-orange-600" size={20} />
//                     <h3 className="font-bold text-slate-800">Risk Analysis</h3>
//                 </div>

//                 <button
//                     onClick={() => setStep(0)}
//                     className="text-xs text-slate-400"
//                 >
//                     Close
//                 </button>
//             </div>

//             <p className="text-sm text-slate-700 mb-4 font-medium">
//                 {analysis?.summary}
//             </p>

//             <div className="space-y-2">
//                 {analysis?.risks?.map((risk, idx) => (
//                     <div key={idx} className="bg-white p-3 rounded-xl flex items-start gap-3 border">
//                         <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />

//                         <div>
//                             <span className="font-bold text-slate-800 block text-xs">
//                                 {risk.med}
//                             </span>

//                             <span className="text-xs text-red-600 font-bold">
//                                 {risk.risk}
//                             </span>
//                         </div>
//                     </div>
//                 ))}
//             </div>
//         </div>
//     );
// };

// export default PredictiveHealthCard;














// import React, { useState } from 'react';
// import { GoogleGenAI } from "@google/genai"; // ✅ NEW SDK
// import { AlertTriangle, Sparkles, Activity, Lock } from "lucide-react";

// // ⚠️ Add your API Key here or in .env
// const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "YOUR_GEMINI_KEY";

// // ✅ Modern SDK initialization
// const ai = new GoogleGenAI({
//     apiKey: GEN_AI_KEY
// });

// const PredictiveHealthCard = ({ medicines, stats }) => {
//     const [analysis, setAnalysis] = useState(null);
//     const [loading, setLoading] = useState(false);
//     const [showResults, setShowResults] = useState(false);

//     const analyzeRisk = async () => {
//         setLoading(true);
//         try {
//             // 1. Identify "At Risk" Medicines (Adherence < 85%)
//             const problemMeds = (stats.medicineBreakdown || []).filter(m => m.adherence < 85);

//             if (problemMeds.length === 0) {
//                 setAnalysis({ summary: "Great job! Your adherence is high.", risks: [] });
//                 setShowResults(true);
//                 return;
//             }

//             // 2. Enrich with 'Condition'
//             const enrichedData = problemMeds.map(pm => {
//                 const fullMed = medicines.find(m => m.name === pm.name);
//                 return {
//                     name: pm.name,
//                     condition: fullMed?.condition || "General Health",
//                     adherence: pm.adherence
//                 };
//             });

//             const prompt = `
// Act as a medical risk analyst. The user has missed doses for these medicines. 
// Predict specific physical consequences they might feel soon based on the condition.

// Data: ${JSON.stringify(enrichedData)}

// Output strictly in JSON format (no markdown):
// {
//     "summary": "Short 1 sentence warning.",
//     "risks": [
//         {"med": "Medicine Name", "risk": "Specific symptom"}
//     ]
// }
// `;

//             // ✅ NEW Gemini API Call
//             const response = await ai.models.generateContent({
//                 model: "gemini-2.5-flash",
//                 contents: prompt
//             });

//             const text = response.text;

//             // Remove markdown if AI adds it
//             const jsonStr = text.replace(/```json|```/g, '').trim();

//             setAnalysis(JSON.parse(jsonStr));
//             setShowResults(true);

//         } catch (error) {
//             console.error("AI Error", error);
//             alert("Could not analyze at this time.");
//         } finally {
//             setLoading(false);
//         }
//     };

//     // --- STATE 1 ---
//     if (!showResults) {
//         return (
//             <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 rounded-3xl shadow-lg text-white mt-6 relative overflow-hidden">
//                 <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={80} /></div>

//                 <div className="relative z-10">
//                     <div className="flex items-center gap-2 mb-2">
//                         <Sparkles size={20} className="text-yellow-300" />
//                         <h3 className="font-bold text-lg">AI Health Predictor</h3>
//                     </div>

//                     <p className="text-indigo-100 text-sm mb-4 max-w-[85%]">
//                         Analyze your missed doses to predict potential health risks.
//                     </p>

//                     <button
//                         onClick={analyzeRisk}
//                         disabled={loading}
//                         className="bg-white text-indigo-600 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-transform"
//                     >
//                         {loading ? (
//                             <><Activity className="animate-spin" size={16} /> Analyzing...</>
//                         ) : (
//                             <><Lock size={16} /> Unlock Insights</>
//                         )}
//                     </button>
//                 </div>
//             </div>
//         );
//     }

//     // --- STATE 2 ---
//     return (
//         <div className="bg-gradient-to-br from-orange-50 to-red-50 p-5 rounded-3xl border border-orange-100 shadow-sm mt-6">
//             <div className="flex items-center justify-between mb-3">
//                 <div className="flex items-center gap-2">
//                     <AlertTriangle className="text-orange-600" size={20} />
//                     <h3 className="font-bold text-slate-800">Risk Analysis</h3>
//                 </div>

//                 <button onClick={() => setShowResults(false)} className="text-xs text-slate-400 font-medium">
//                     Close
//                 </button>
//             </div>

//             <p className="text-sm text-slate-700 mb-4 font-medium">
//                 {analysis?.summary || "Analysis complete."}
//             </p>

//             <div className="space-y-2">
//                 {analysis?.risks?.length > 0 ? analysis.risks.map((risk, idx) => (
//                     <div key={idx} className="bg-white p-3 rounded-xl flex items-start gap-3 border border-orange-100">
//                         <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
//                         <div>
//                             <span className="font-bold text-slate-800 block text-xs">{risk.med}</span>
//                             <span className="text-xs text-red-600 font-bold">{risk.risk}</span>
//                         </div>
//                     </div>
//                 )) : (
//                     <div className="bg-emerald-50 p-3 rounded-xl text-emerald-700 text-xs font-bold text-center">
//                         No significant risks detected!
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default PredictiveHealthCard;
