import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { 
  Send, 
  Mic, 
  MicOff, 
  Image as ImageIcon, 
  X, 
  BrainCircuit,
  HeartPulse,
  Bot, 
  User, 
  ChevronDown, 
  Loader2,
  Trash2
} from "lucide-react";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;

const AiChatbot = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null); 

  // 🎤 Speech setup (Logic Unchanged)
  useEffect(() => {
    if (!isSpeechRecognitionSupported) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => setInput(event.results[0][0].transcript);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, []);

  // 🧠 Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isChatOpen]);

  const handleListen = () => {
    if (isListening) recognitionRef.current.stop();
    else recognitionRef.current.start();
  };

  const handleImageChange = (e) => {
    if (e.target.files[0]) setImage(e.target.files[0]);
  };

  const handleRemoveImage = () => {
    setImage(null);
    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() && !image) return;

    const userMessage = {
      text: input,
      sender: "user",
      image: image ? URL.createObjectURL(image) : null,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("prompt", input);

    // ✅ 2. ADD THIS LINE (Time Awareness)
    formData.append("userLocalTime", new Date().toLocaleTimeString());

    if (image) formData.append("image", image);

    setInput("");
    setImage(null);
    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";


const token = localStorage.getItem('token'); 

    if (!token) {
        alert("You must be logged in to use the AI.");
        return;
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/ai/query`, {
        method: "POST",
        headers: {
            'Authorization': `Bearer ${token}` 
        },
        body: formData,
      });
      if (!response.ok) throw new Error("Network error");
      const data = await response.json();
      const aiMessage = { text: data.response, sender: "ai" };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Fetch error:", error);
      const errorMessage = {
        text: "Sorry, I'm having trouble connecting. Please try again.",
        sender: "ai",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChat = () => setIsChatOpen(!isChatOpen);

  return (
    <>
     {/* 🟢 Floating Action Button (FAB) */}
      <div className={`fixed bottom-24 right-5 z-50 transition-all duration-300 ${isChatOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}>
        <button
          onClick={toggleChat}
          className="group relative flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-full text-white shadow-lg hover:shadow-emerald-500/30 transition-all duration-300 active:scale-95"
        >
          <BrainCircuit 
            size={28} 
            strokeWidth={1.5}
            className="animate-[pulse_3s_ease-in-out_infinite]" 
          />
          
          {/* Notification Dot */}
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full"></span>
        </button>
      </div>

      {/* 📱 Chat Interface Overlay */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
          
          {/* Backdrop (Click to close) */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={toggleChat}
          ></div>

          {/* Chat Card */}
          <div className="relative w-full sm:w-[400px] h-[75vh] sm:h-[650px] bg-slate-50 sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            
            {/* --- HEADER --- */}
            <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-emerald-100 to-teal-50 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-100">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg leading-tight">Med.AI <span className="font-normal text-xs text-red-600">(Only for Educational purpose)</span></h3>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Online Assistant</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={toggleChat}
                className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors"
              >
                <ChevronDown size={20} />
              </button>
            </div>

            {/* --- MESSAGES AREA --- */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scroll-smooth">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-50 mt-10">
                  <Bot size={48} className="text-slate-300 mb-2" />
                  <p className="text-slate-400 text-sm">Ask me anything about your normal health or about any medicine!</p>
                </div>
              )}

              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[85%] ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"} gap-2`}>
                    
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-auto ${msg.sender === "user" ? "bg-slate-200 text-slate-500" : "bg-emerald-100 text-emerald-600"}`}>
                      {msg.sender === "user" ? <User size={16} /> : <Bot size={16} />}
                    </div>

                    {/* Bubble */}
                    <div 
                      className={`p-3.5 rounded-2xl text-[15px] shadow-sm ${
                        msg.sender === "user" 
                          ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-br-none" 
                          : "bg-white text-slate-700 border border-slate-100 rounded-bl-none"
                      }`}
                    >
                      {msg.image && (
                        <img 
                          src={msg.image} 
                          alt="Uploaded" 
                          className="rounded-lg mb-2 max-h-40 w-full object-cover border border-white/20" 
                        />
                      )}
                      <div className={`prose prose-sm max-w-none ${msg.sender === 'user' ? 'prose-invert' : ''}`}>
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-2 max-w-[85%]">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                      <Bot size={16} />
                    </div>
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-slate-100 shadow-sm flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-emerald-500" />
                      <span className="text-sm text-slate-500">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* --- IMAGE PREVIEW --- */}
            {image && (
              <div className="px-4 pb-2">
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-emerald-100 shadow-sm">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden">
                    <img 
                      src={URL.createObjectURL(image)} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{image.name}</p>
                    <p className="text-[10px] text-slate-400">Ready to send</p>
                  </div>
                  <button 
                    onClick={handleRemoveImage}
                    className="p-1.5 text-red-400 hover:text-red-500 bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* --- INPUT AREA --- */}
            <form onSubmit={handleSendMessage} className="bg-white p-3 border-t border-slate-100 flex items-center gap-2 pb-5 sm:pb-3">
              
              {/* Image Upload */}
              <label className="flex-shrink-0 cursor-pointer p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <ImageIcon size={22} />
              </label>

              {/* Text Input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask MedMind..."
                  className="w-full bg-slate-100 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  disabled={isLoading}
                />
              </div>

              {/* Mic / Send Button */}
              {input.trim() || image ? (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-shrink-0 w-11 h-11 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-emerald-600 active:scale-95 transition-all"
                >
                  <Send size={20} className="ml-0.5" />
                </button>
              ) : (
                isSpeechRecognitionSupported && (
                  <button
                    type="button"
                    onClick={handleListen}
                    className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                      isListening 
                        ? "bg-red-500 text-white animate-pulse shadow-red-200 shadow-lg" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                )
              )}
            </form>

          </div>
        </div>
      )}
    </>
  );
};

export default AiChatbot;










// import React, { useState, useEffect, useRef } from "react";
// import ReactMarkdown from "react-markdown";

// const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
// const isSpeechRecognitionSupported = !!SpeechRecognition;

// const AiChatbot = () => {
//   const [isChatOpen, setIsChatOpen] = useState(false);
//   const [messages, setMessages] = useState([]);
//   const [input, setInput] = useState("");
//   const [image, setImage] = useState(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isListening, setIsListening] = useState(false);
//   const recognitionRef = useRef(null);
//   const messagesEndRef = useRef(null); //  reference for auto-scroll

//   // 🎤 Speech setup
//   useEffect(() => {
//     if (!isSpeechRecognitionSupported) return;
//     const recognition = new SpeechRecognition();
//     recognition.continuous = false;
//     recognition.lang = "en-US";
//     recognition.interimResults = false;
//     recognition.onstart = () => setIsListening(true);
//     recognition.onend = () => setIsListening(false);
//     recognition.onresult = (event) => setInput(event.results[0][0].transcript);
//     recognition.onerror = () => setIsListening(false);
//     recognitionRef.current = recognition;
//   }, []);

//   // 🧠 Auto-scroll when new message added
//   useEffect(() => {
//     if (messagesEndRef.current) {
//       messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
//     }
//   }, [messages, isLoading]);

//   const handleListen = () => {
//     if (isListening) recognitionRef.current.stop();
//     else recognitionRef.current.start();
//   };

//   const handleImageChange = (e) => {
//     if (e.target.files[0]) setImage(e.target.files[0]);
//   };

//   const handleRemoveImage = () => {
//     setImage(null);
//     const fileInput = document.getElementById("file-input");
//     if (fileInput) fileInput.value = "";
//   };

//   const handleSendMessage = async (e) => {
//     e.preventDefault();
//     if (!input.trim() && !image) return;

//     const userMessage = {
//       text: input,
//       sender: "user",
//       image: image ? URL.createObjectURL(image) : null,
//     };
//     setMessages((prev) => [...prev, userMessage]);
//     setIsLoading(true);

//     const formData = new FormData();
//     formData.append("prompt", input);
//     if (image) formData.append("image", image);

//     setInput("");
//     setImage(null);
//     const fileInput = document.getElementById("file-input");
//     if (fileInput) fileInput.value = "";

//     try {
//       const API_BASE_URL = import.meta.env.VITE_API_URL;
//       const response = await fetch(`${API_BASE_URL}/ai/query`, {
//         method: "POST",
//         body: formData,
//       });
//       if (!response.ok) throw new Error("Network error");
//       const data = await response.json();
//       const aiMessage = { text: data.response, sender: "ai" };
//       setMessages((prev) => [...prev, aiMessage]);
//     } catch (error) {
//       console.error("Fetch error:", error);
//       const errorMessage = {
//         text: "Sorry, I'm having trouble connecting. Please try again.",
//         sender: "ai",
//       };
//       setMessages((prev) => [...prev, errorMessage]);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const toggleChat = () => setIsChatOpen(!isChatOpen);

//   return (
//     <>
//       {/* 💬 Floating Button */}
//       <div className="fixed bottom-[72px] right-5 z-50">
//         <button
//           onClick={toggleChat}
//           className="bg-gradient-to-r from-green-600 to-emerald-500 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transform transition-all duration-300 focus:outline-none border-2 sm:border-4 border-white"
//         >
//           {isChatOpen ? (
//             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//             </svg>
//           ) : (
//             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-7 sm:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
//             </svg>
//           )}
//         </button>
//       </div>

//       {/* 🩺 Chat Window */}
//       <div
//         className={`fixed bottom-[71px] right-2 sm:right-6 z-101 w-[94%] sm:w-[420px] h-[80vh] sm:h-[600px] max-w-full bg-white border border-gray-200 rounded-3xl shadow-2xl flex flex-col transition-all duration-300 transform ${
//           isChatOpen
//             ? "opacity-100 translate-y-0 scale-100"
//             : "opacity-0 translate-y-8 scale-95 pointer-events-none"
//         }`}
//       >
//         {/* Header */}
//         <div className="bg-gradient-to-r from-emerald-600 to-green-500 text-white p-4 sm:p-5 rounded-t-3xl flex items-center justify-between shadow-md">
//           <div>
//             <h2 className="text-lg sm:text-xl font-semibold">Med.AI Assistant</h2>
//             <p className="text-xs sm:text-sm text-blue-100">
//               <span className="text-red-300 font-semibold">Disclaimer:</span> Not a medical professional.
//             </p>
//           </div>
//           <button onClick={toggleChat} className="text-blue-100 hover:text-white transition-colors">
//             <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//             </svg>
//           </button>
//         </div>

//         {/* Messages */}
//         <div className="p-3 sm:p-4 flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-gray-100 scrollbar-thin scrollbar-thumb-green-200 scrollbar-track-transparent">
//           {messages.map((msg, index) => (
//             <div key={index} className={`my-2 flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
//               <div
//                 className={`prose p-3 sm:p-4 rounded-2xl max-w-[85%] sm:max-w-[80%] shadow-sm ${
//                   msg.sender === "user"
//                     ? "bg-green-600 text-white prose-invert"
//                     : "bg-white text-gray-800 border border-gray-200"
//                 }`}
//               >
//                 {msg.image && (
//                   <img src={msg.image} alt="upload" className="rounded-lg mb-2 max-h-36 sm:max-h-40 shadow-sm" />
//                 )}
//                 <ReactMarkdown>{msg.text}</ReactMarkdown>
//               </div>
//             </div>
//           ))}

//           {isLoading && (
//             <div className="my-2 flex justify-start">
//               <div className="p-3 rounded-2xl bg-gray-200 text-gray-500 animate-pulse">Thinking...</div>
//             </div>
//           )}

//           {/* 👇 This invisible div ensures auto-scroll to bottom */}
//           <div ref={messagesEndRef} />
//         </div>

//         {/* Image Preview */}
//         {image && (
//           <div className="flex items-center justify-between p-3 sm:p-4 bg-green-50 border-t border-green-100">
//             <div className="flex items-center space-x-3">
//               <img
//                 src={URL.createObjectURL(image)}
//                 alt="Preview"
//                 className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover border border-green-200"
//               />
//               <p className="text-sm text-gray-700 truncate max-w-[150px] sm:max-w-[200px]">{image.name}</p>
//             </div>
//             <button
//               onClick={handleRemoveImage}
//               className="p-2 text-red-500 hover:text-red-600 transition"
//               title="Remove image"
//             >
//               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//               </svg>
//             </button>
//           </div>
//         )}

//         {/* Input */}
//         <form
//           onSubmit={handleSendMessage}
//           className="p-3 sm:p-4 border-t border-gray-200 bg-white rounded-b-3xl flex items-center space-x-2 sm:space-x-3"
//         >
//           <label className="cursor-pointer flex-shrink-0">
//             <input
//               id="file-input"
//               type="file"
//               accept="image/*"
//               onChange={handleImageChange}
//               className="hidden"
//             />
//             <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-green-50 hover:bg-green-100 rounded-full border border-green-200 text-green-600 transition-all">
//               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
//               </svg>
//             </div>
//           </label>

//           <input
//             type="text"
//             value={input}
//             onChange={(e) => setInput(e.target.value)}
//             placeholder="Ask about your health..."
//             className="flex-grow px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700 text-sm"
//             disabled={isLoading}
//           />

//           {isSpeechRecognitionSupported && (
//             <button
//               type="button"
//               onClick={handleListen}
//               className={`p-2 sm:p-2.5 rounded-full transition-all shadow-md flex-shrink-0 ${
//                 isListening
//                   ? "bg-red-500 text-white animate-pulse"
//                   : "bg-gray-100 text-gray-700 hover:bg-gray-200"
//               }`}
//             >
//               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v10m0 0a3 3 0 01-3-3V5a3 3 0 016 0v3a3 3 0 01-3 3zm0 0v7m0 0H8m4 0h4" />
//               </svg>
//             </button>
//           )}

//           <button
//             type="submit"
//             className="px-3 sm:px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-full font-medium hover:from-green-700 hover:to-emerald-600 transition-all disabled:opacity-60 shadow-md text-sm flex-shrink-0"
//             disabled={isLoading}
//           >
//             Send
//           </button>
//         </form>
//       </div>
//     </>
//   );
// };

// export default AiChatbot;
