import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
    AlertTriangle, Sparkles, Activity, Lock, Send, 
    CheckCircle2, WifiOff 
} from "lucide-react";
import { useTranslation } from 'react-i18next';

const GEN_AI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Safe initialization
const ai = GEN_AI_KEY ? new GoogleGenAI({ apiKey: GEN_AI_KEY }) : null;

const PredictiveHealthCard = ({ medicines, stats }) => {
    const { t, i18n } = useTranslation();
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0);
    const [userSymptom, setUserSymptom] = useState("");
    const [language, setLanguage] = useState('en');

    const analyzeRisk = async () => {
        // 1. OFFLINE CHECK
        if (!navigator.onLine) {
            setAnalysis({ 
               summary: language === 'hi' ? "आप ऑफलाइन हैं। AI के लिए इंटरनेट कनेक्ट करें।" : language === 'or' ? "ଆପଣ ଅଫଲାଇନ୍ ଅଛନ୍ତି। ଦୟାକରି ଇଣ୍ଟରନେଟ୍ ସଂଯୋଗ କରନ୍ତୁ।" : "You are offline. Please connect to the internet to use AI analysis.",
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

                // Tell the AI exactly which language to respond in based on the app's current setting
            let targetLanguageStr = "Simple English";
            if (language === 'hi') targetLanguageStr = "Hindi language";
            if (language === 'or') targetLanguageStr = "Odia language";

            const missedData = problemMeds.map(pm => {
                const fullMed = medicines.find(m => m.name === pm.name);
                return {
                    name: pm.name,
                    condition: fullMed?.condition || "General Health",
                    adherence: `${pm.adherence}%`,
                };
            });

            // IMPROVED PROMPT WITH MEDICAL INTELLIGENCE
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
- Response Language MUST be: ${targetLanguageStr}

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

            // CHANGED TO MORE RELIABLE FLASH MODEL
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
                summary: language === 'hi' ? "सर्वर व्यस्त है। कृपया बाद में प्रयास करें।" : "Service busy. Please try again later.",
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
                    <h3 className="font-bold text-lg">{t('ai.title')}</h3>
                    <p className="text-indigo-100 text-sm mb-4">
                        {t('ai.subtitle')}
                    </p>
                    <button onClick={() => setStep(1)} className="bg-white text-indigo-600 px-4 py-2.5 rounded-xl font-bold flex gap-2 active:scale-95 transition-transform">
                        <Lock size={16} /> {t('ai.checkStatus')}
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
                    placeholder={t('ai.symptomPlaceholder')}
                    value={userSymptom}
                    onChange={(e) => setUserSymptom(e.target.value)}
                />

                <button
                    onClick={analyzeRisk}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 active:scale-95 transition-transform disabled:opacity-70 disabled:active:scale-100"
                >
                    {loading ? <Activity className="animate-spin" size={16} /> : <Send size={16} />}
                    {loading ? t('ai.analyzing') : t('ai.analyze')}
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
                    <h3 className={`font-bold ${style.text}`}>{t('ai.analysisLabel')}</h3>
                </div>
                <button onClick={() => setStep(0)} className="text-xs font-bold opacity-60">{t('common.close')}</button>
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
