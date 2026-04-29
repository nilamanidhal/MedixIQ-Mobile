import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import {
    Send, Mic, MicOff, Image as ImageIcon, X,
    BrainCircuit, Bot, User, ChevronDown, Trash2, Volume2, VolumeX, Sparkles, Plus,
    FileText, Pill, Stethoscope, FlaskConical, MessageSquare, Clock
} from "lucide-react";
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';


const MODES = [
    { id: 'general', label: 'Ask Health', icon: <Stethoscope size={20} />, bg: 'bg-emerald-500', lightBg: 'bg-emerald-50', textColor: 'text-emerald-600', border: 'border-emerald-200', desc: 'General health questions', suggestions: ["Did I take all medicines today?", "I have a headache, what to do?", "Is it safe to skip today's dose?"] },
    { id: 'prescription', label: 'Prescription', icon: <FileText size={20} />, bg: 'bg-blue-500', lightBg: 'bg-blue-50', textColor: 'text-blue-600', border: 'border-blue-200', desc: 'Upload & explain prescriptions', suggestions: ["Explain this doctor's handwriting", "What does this prescription mean?", "Are these medicines safe together?"] },
    { id: 'report', label: 'Report AI', icon: <FlaskConical size={20} />, bg: 'bg-purple-500', lightBg: 'bg-purple-50', textColor: 'text-purple-600', border: 'border-purple-200', desc: 'Blood reports, X-rays explained', suggestions: ["Explain my CBC report", "What does high creatinine mean?", "Is my haemoglobin normal?"] },
    { id: 'medicine', label: 'Medicine Info', icon: <Pill size={20} />, bg: 'bg-orange-500', lightBg: 'bg-orange-50', textColor: 'text-orange-600', border: 'border-orange-200', desc: 'Drug details & interactions', suggestions: ["Tell me about Metformin", "Side effects of Paracetamol?", "Can I take Ibuprofen with my meds?"] }
];

const AiChatbot = () => {
    const { token, API_BASE_URL } = useAuth();
    const [view, setView] = useState('home');
    const [sessions, setSessions] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [messages, setMessages] = useState([]);
    const [selectedMode, setSelectedMode] = useState(MODES[0]);
    const [showSidebar, setShowSidebar] = useState(false);
    
    const [input, setInput] = useState("");
    const [image, setImage] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const aiTempIdRef = useRef(null);
    const { t, i18n } = useTranslation();

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
    useEffect(() => { if (isChatOpen) loadSessions(); }, [isChatOpen]);

    // NATIVE MIC LISTENER (Attached ONLY ONCE to prevent memory leaks)
    useEffect(() => {
        let micListener = null;

        const setupMicListener = async () => {
            try {
                // Clear any leftover ghost listeners
                await SpeechRecognition.removeAllListeners();
                
                micListener = await SpeechRecognition.addListener('partialResults', (data) => {
                    if (data.matches && data.matches.length > 0) {
                        setInput(data.matches[0]);
                    }
                });
            } catch (e) {
                console.log("Mic setup error:", e);
            }
        };

        setupMicListener();

        return () => {
            if (micListener) micListener.remove();
        };
    }, []);

    // Map app language to Native OS language codes
    const getNativeLangCode = () => {
        const lang = i18n.language || 'en';
        if (lang === 'hi') return 'hi-IN'; // Hindi (India)
        if (lang === 'or') return 'or-IN'; // Odia (India)
        return 'en-IN'; // English (India) - gives a natural Indian accent!
    };

    const loadSessions = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/ai/sessions`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch (e) { console.error("Sessions load error:", e); }
    };

    const openSession = async (session) => {
        try {
            const res = await fetch(`${API_BASE_URL}/ai/sessions/${session._id}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setActiveSession(data.session);
            setMessages(data.session.messages || []);
            setSelectedMode(MODES.find(m => m.id === data.session.mode) || MODES[0]);
            setView('chat'); setShowSidebar(false);
        } catch (e) { console.error("Open session error:", e); }
    };

    // MODIFIED: "Lazy" Session Creation
    // We don't call the backend here anymore. We just set up a local "draft".
    const startNewChat = (mode) => {
        setActiveSession({ _id: 'draft', mode: mode.id, title: 'New Chat' });
        setMessages([]); 
        setSelectedMode(mode); 
        setView('chat');
    };

    const deleteSession = async (sessionId, e) => {
        e.stopPropagation();
        try {
            await fetch(`${API_BASE_URL}/ai/sessions/${sessionId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            setSessions(prev => prev.filter(s => s._id !== sessionId));
            if (activeSession?._id === sessionId) { setView('home'); setActiveSession(null); setMessages([]); }
        } catch (e) { console.error("Delete error:", e); }
    };

    const sendMessage = async (e, quickText = null) => {
        if (e) e.preventDefault();
        const msgText = quickText || input;
        if (!msgText.trim() && !image) return;
        if (!activeSession) return;

        const tempId = Date.now();
        const aiTempId = tempId + 1;
        aiTempIdRef.current = aiTempId;

        // Show optimistic UI instantly
        setMessages(prev => [...prev, 
            { _id: tempId, sender: 'user', text: msgText, image: image ? URL.createObjectURL(image) : null },
            { _id: aiTempId, sender: 'ai', text: '', isStreaming: true }
        ]);

        setInput("");
        const currentImage = image;
        setImage(null);
        setIsStreaming(true);
        abortControllerRef.current = new AbortController();

        try {
            let targetSessionId = activeSession._id;

            // LAZY CREATION TRIGGER: 
            // If this is the first message of a new chat, create the session in DB NOW.
            if (targetSessionId === 'draft') {
                const sessionRes = await fetch(`${API_BASE_URL}/ai/sessions`, {
                    method: 'POST', 
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: selectedMode.id })
                });
                const sessionData = await sessionRes.json();
                targetSessionId = sessionData.session._id;
                
                // Immediately update our active session and push to the sidebar history
                setActiveSession(sessionData.session);
                setSessions(prev => [sessionData.session, ...prev]);
            }

            // Proceed with the streaming message using the real DB session ID
            const formData = new FormData();
            formData.append("prompt", msgText);
            formData.append("userLocalTime", new Date().toLocaleTimeString());
            if (currentImage) formData.append("image", currentImage);

            const response = await fetch(`${API_BASE_URL}/ai/sessions/${targetSessionId}/message`, {
                method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData, signal: abortControllerRef.current.signal
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                const lines = text.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.chunk) {
                            accumulated += data.chunk;
                            setMessages(prev => prev.map(m => m._id === aiTempId ? { ...m, text: accumulated } : m));
                        }
                        if (data.done) {
                            setMessages(prev => prev.map(m => m._id === aiTempId ? { ...m, isStreaming: false } : m));
                            
                            // Automatically update the title generated by the backend
                            if (data.title) {
                                setActiveSession(prev => ({ ...prev, title: data.title }));
                                setSessions(prev => prev.map(s => s._id === data.sessionId ? { ...s, title: data.title } : s));
                            }
                        }
                    } catch(e) {}
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setMessages(prev => prev.map(m => m._id === aiTempId ? { ...m, text: "Connection error. Please try again.", isStreaming: false } : m));
            }
        } finally {
            setIsStreaming(false);
        }
    };

   //  NATIVE CAPACITOR MICROPHONE (Speech to Text)
    const toggleListening = async () => {
        try {
            // 1. If currently listening, stop it manually
            if (isListening) {
                setIsListening(false);
                await SpeechRecognition.stop();
                return;
            }

            // 2. Check & Request Permissions
            const { speechRecognition } = await SpeechRecognition.checkPermissions();
            if (speechRecognition !== 'granted') {
                const req = await SpeechRecognition.requestPermissions();
                if (req.speechRecognition !== 'granted') {
                    alert("Microphone permission denied.");
                    return;
                }
            }

            // 3. Start UI state
            setIsListening(true);
            setInput("");

            // 4. Start Native Hardware Mic
            await SpeechRecognition.start({
                language: getNativeLangCode(), 
                partialResults: true,
                popup: false, // Keeps it hidden so text types directly into your input box
            });

        } catch (error) {
            // 5. Catch the "No match" error when user is silent
            console.log("Mic Error or Auto-stopped:", error);
            setIsListening(false);
            
            // Failsafe stop to reset hardware
            try { await SpeechRecognition.stop(); } catch(e) {}
        }
    };

    // NATIVE CAPACITOR SPEAKER (Text to Speech)
    const speakText = async (text) => {
        try {
            if (isSpeaking) {
                await TextToSpeech.stop();
                setIsSpeaking(false);
                return;
            }
            setIsSpeaking(true);
            
            // 1. Better Markdown Cleaning (Removes **, #, links, etc.)
            // 2. NO substring limit! It will read the whole thing.
            const cleanText = text
                .replace(/\*\*/g, '') 
                .replace(/\*/g, '')   
                .replace(/#/g, '')    
                .replace(/`/g, '')    
                .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') 
                .trim();
            
            await TextToSpeech.speak({
                text: cleanText, 
                lang: getNativeLangCode(), //  Now talks in Hindi/Odia!
                rate: 1.0, 
                pitch: 1.0, 
                category: 'ambient',
            });
            setIsSpeaking(false);
        } catch (err) {
            console.error("TTS Error:", err);
            setIsSpeaking(false);
        }
    };

    return (
        <>
            <div className={`fixed bottom-24 right-5 z-50 transition-all duration-300 ${isChatOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}>
                <button onClick={() => setIsChatOpen(true)} className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full text-white shadow-[0_4px_15px_rgba(37,99,235,0.4)] active:scale-95">
                    <BrainCircuit size={28} strokeWidth={1.5} className="animate-pulse" />
                    <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full" />
                </button>
            </div>

            {isChatOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setIsChatOpen(false); setShowSidebar(false); }} />
                    <div className="relative w-full sm:w-[440px] h-[85vh] sm:h-[700px] bg-slate-50 sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                        
                        {/* Sidebar */}
                        <div className={`absolute inset-y-0 left-0 z-20 w-72 bg-white shadow-2xl transform transition-transform duration-300 sm:rounded-l-[2rem] rounded-tl-[2rem] flex flex-col ${showSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-extrabold text-slate-800">Chat History</h3>
                                <button onClick={() => setShowSidebar(false)} className="p-1.5 bg-slate-100 rounded-full active:scale-95"><X size={16} className="text-slate-500" /></button>
                            </div>
                            <button onClick={() => { setView('home'); setShowSidebar(false); setActiveSession(null); }} className="mx-4 mt-4 flex items-center gap-2 p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 font-bold text-sm hover:bg-blue-100 transition-colors active:scale-95">
                                <Plus size={18} /> New Chat
                            </button>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 mt-2">
                                {sessions.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-8 font-medium">No chat history yet</p>
                                ) : (
                                    sessions.map(session => {
                                        const mode = MODES.find(m => m.id === session.mode) || MODES[0];
                                        return (
                                            <div key={session._id} onClick={() => openSession(session)} className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-slate-50 ${activeSession?._id === session._id ? 'bg-slate-100' : ''}`}>
                                                <div className={`w-10 h-10 ${mode.lightBg} ${mode.textColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                                    {React.cloneElement(mode.icon, { size: 18 })}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{session.title}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{new Date(session.lastMessageAt).toLocaleDateString()}</p>
                                                </div>
                                                <button onClick={(e) => deleteSession(session._id, e)} className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {showSidebar && <div className="absolute inset-0 z-10 bg-black/20" onClick={() => setShowSidebar(false)} />}

                        {/* Main UI */}
                        <div className="flex-1 flex flex-col w-full">
                            <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-shrink-0 shadow-sm z-10">
                                <button onClick={() => view === 'chat' ? setShowSidebar(!showSidebar) : setIsChatOpen(false)} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-600 flex-shrink-0 transition-colors">
                                    {view === 'chat' ? <MessageSquare size={20} /> : <X size={20} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    {view === 'chat' ? (
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 ${selectedMode.bg} rounded-lg flex items-center justify-center shadow-sm`}>{React.cloneElement(selectedMode.icon, { size: 12, className: 'text-white' })}</div>
                                                <h3 className="font-extrabold text-slate-800 text-base truncate">{activeSession?.title || selectedMode.label}</h3>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5 ml-8">
                                                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isStreaming ? 'Typing...' : 'Online'}</span>
                                            </div>
                                        </div>
                                    ) : <h3 className="font-extrabold text-slate-800 text-lg">MedixIQ AI</h3>}
                                </div>
                                {view === 'chat' && <button onClick={() => { setView('home'); setActiveSession(null); setMessages([]); }} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-600"><ChevronDown size={20} /></button>}
                            </div>

                            {/* HOME VIEW */}
                            {view === 'home' && (
                                <div className="flex-1 overflow-y-auto">
                                    <div className="p-8 text-center bg-gradient-to-b from-white to-slate-50">
                                        <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                                            <BrainCircuit size={40} className="text-white" />
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">MedixIQ AI</h2>
                                        <p className="text-slate-500 font-medium text-sm mt-1">Your personalized health intelligence</p>
                                        <p className="text-red-600 font-medium text-sm mt-1">NOTE: This is only for Educational Purpose</p>
                                    </div>
                                    <div className="px-5 pb-4">
                                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Select Mode</p>
                                        <div className="grid grid-cols-2 gap-3.5">
                                            {MODES.map(mode => (
                                                <button key={mode.id} onClick={() => startNewChat(mode)} className={`p-4 rounded-[1.5rem] border-2 ${mode.border} bg-white text-left transition-all active:scale-95 hover:shadow-md`}>
                                                    <div className={`w-12 h-12 ${mode.lightBg} rounded-xl flex items-center justify-center mb-3`}>{React.cloneElement(mode.icon, { size: 24, className: mode.textColor })}</div>
                                                    <p className={`font-extrabold text-sm text-slate-800`}>{mode.label}</p>
                                                    <p className="text-[10px] text-slate-500 mt-1 font-medium leading-snug">{mode.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {sessions.length > 0 && (
                                        <div className="px-5 pb-6 mt-2">
                                            <div className="flex items-center justify-between mb-3"><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Recent</p><button onClick={() => setShowSidebar(true)} className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md">See all</button></div>
                                            <div className="space-y-2.5">
                                                {sessions.slice(0, 3).map(session => {
                                                    const mode = MODES.find(m => m.id === session.mode) || MODES[0];
                                                    return (
                                                        <button key={session._id} onClick={() => openSession(session)} className="w-full flex items-center gap-3.5 p-3.5 bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-left">
                                                            <div className={`w-10 h-10 ${mode.lightBg} ${mode.textColor} rounded-xl flex items-center justify-center`}>{React.cloneElement(mode.icon, { size: 18 })}</div>
                                                            <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{session.title}</p><p className="text-[10px] font-medium text-slate-400 flex items-center gap-1 mt-0.5"><Clock size={10} />{new Date(session.lastMessageAt).toLocaleDateString()}</p></div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* CHAT VIEW */}
                            {view === 'chat' && (
                                <>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                                        {messages.length === 0 && (
                                            <div className={`p-5 bg-white rounded-[1.5rem] border ${selectedMode.border} shadow-sm`}>
                                                <div className="flex items-center gap-4 mb-4"><div className={`w-12 h-12 ${selectedMode.lightBg} rounded-xl flex items-center justify-center`}>{React.cloneElement(selectedMode.icon, { size: 24, className: selectedMode.textColor })}</div><div><p className={`font-extrabold text-lg text-slate-800`}>{selectedMode.label}</p><p className="text-xs font-medium text-slate-500">{selectedMode.desc}</p></div></div>
                                                <div className="space-y-2">{selectedMode.suggestions.map((s, i) => <button key={i} onClick={() => sendMessage(null, s)} className={`w-full text-left text-sm font-medium p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:${selectedMode.border} hover:${selectedMode.lightBg} transition-all active:scale-95`}>{s}</button>)}</div>
                                            </div>
                                        )}
                                        {messages.map((msg, idx) => (
                                            <div key={msg._id || idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                                                <div className={`flex max-w-[88%] ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"} gap-2`}>
                                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-auto shadow-sm ${msg.sender === "user" ? "bg-slate-200 text-slate-600" : `${selectedMode.bg} text-white`}`}>{msg.sender === "user" ? <User size={16} /> : <Bot size={16} />}</div>
                                                    <div className={`relative p-4 rounded-[1.5rem] text-sm shadow-sm ${msg.sender === "user" ? `bg-slate-800 text-white rounded-br-none` : "bg-white text-slate-800 border border-slate-100 rounded-bl-none"}`}>
                                                        {msg.image && <img src={msg.image} alt="Upload" className="rounded-xl mb-3 max-h-48 w-full object-cover border border-slate-100" />}
                                                        <div className={`prose prose-sm max-w-none ${msg.sender === 'user' ? 'prose-invert' : 'prose-slate'}`}><ReactMarkdown>{msg.text || ''}</ReactMarkdown></div>
                                                        {msg.isStreaming && <span className={`inline-block w-2.5 h-4 bg-slate-400 ml-1 animate-pulse rounded-sm`} />}
                                                        {msg.sender === 'ai' && !msg.isStreaming && msg.text && (
                                                            <button onClick={() => speakText(msg.text)} className="absolute -bottom-3 -right-2 w-8 h-8 bg-white border border-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:text-blue-600 shadow-md active:scale-90 transition-transform">{isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input Area */}
                                    <div className="bg-white px-4 py-3 border-t border-slate-100 flex-shrink-0">
                                        {image && (
                                            <div className="mb-3">
                                                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                                                    <img src={URL.createObjectURL(image)} alt="preview" className="w-10 h-10 rounded-lg object-cover" />
                                                    <p className="flex-1 text-xs font-bold text-slate-700 truncate">{image.name}</p>
                                                    <button onClick={() => setImage(null)} className="p-1.5 text-red-500 bg-red-100 rounded-lg active:scale-95"><X size={16} /></button>
                                                </div>
                                            </div>
                                        )}
                                        <form onSubmit={sendMessage} className="flex items-center gap-2">
                                            {(selectedMode.id === 'prescription' || selectedMode.id === 'report') && (
                                                <label className="flex-shrink-0 cursor-pointer p-3 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-full transition-colors active:scale-95"><input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} className="hidden" /><ImageIcon size={20} /></label>
                                            )}
                                            <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-slate-50 border border-slate-100 text-slate-800 placeholder-slate-400 text-sm px-5 py-3.5 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium" disabled={isStreaming} />
                                            {isStreaming ? (
                                                <button type="button" onClick={() => abortControllerRef.current?.abort()} className="flex-shrink-0 w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md active:scale-95"><X size={20} /></button>
                                            ) : input.trim() || image ? (
                                                <button type="submit" className={`flex-shrink-0 w-12 h-12 ${selectedMode.bg} text-white rounded-full flex items-center justify-center active:scale-95 shadow-md shadow-${selectedMode.color}-500/30`}><Send size={20} className="ml-0.5" /></button>
                                            ) : (
                                                <button type="button" onClick={toggleListening} className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 ${isListening ? "bg-red-500 text-white animate-pulse shadow-red-500/30" : "bg-slate-800 text-white shadow-slate-800/30"}`}>
                                                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                                                </button>
                                            )}
                                        </form>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AiChatbot;

