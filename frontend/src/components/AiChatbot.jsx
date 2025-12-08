import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

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
  const messagesEndRef = useRef(null); // 👈 reference for auto-scroll

  // 🎤 Speech setup
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

  // 🧠 Auto-scroll when new message added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

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
    if (image) formData.append("image", image);

    setInput("");
    setImage(null);
    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/ai/query`, {
        method: "POST",
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
      {/* 💬 Floating Button */}
      <div className="fixed bottom-5 right-5 z-50">
        <button
          onClick={toggleChat}
          className="bg-gradient-to-r from-green-600 to-emerald-500 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transform transition-all duration-300 focus:outline-none border-2 sm:border-4 border-white"
        >
          {isChatOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-7 sm:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )}
        </button>
      </div>

      {/* 🩺 Chat Window */}
      <div
        className={`fixed bottom-20 right-2 sm:right-6 z-40 w-[94%] sm:w-[420px] h-[80vh] sm:h-[600px] max-w-full bg-white border border-gray-200 rounded-3xl shadow-2xl flex flex-col transition-all duration-300 transform ${
          isChatOpen
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-8 scale-95 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-500 text-white p-4 sm:p-5 rounded-t-3xl flex items-center justify-between shadow-md">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold">Med.AI Assistant</h2>
            <p className="text-xs sm:text-sm text-blue-100">
              <span className="text-red-300 font-semibold">Disclaimer:</span> Not a medical professional.
            </p>
          </div>
          <button onClick={toggleChat} className="text-blue-100 hover:text-white transition-colors">
            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="p-3 sm:p-4 flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-gray-100 scrollbar-thin scrollbar-thumb-green-200 scrollbar-track-transparent">
          {messages.map((msg, index) => (
            <div key={index} className={`my-2 flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`prose p-3 sm:p-4 rounded-2xl max-w-[85%] sm:max-w-[80%] shadow-sm ${
                  msg.sender === "user"
                    ? "bg-green-600 text-white prose-invert"
                    : "bg-white text-gray-800 border border-gray-200"
                }`}
              >
                {msg.image && (
                  <img src={msg.image} alt="upload" className="rounded-lg mb-2 max-h-36 sm:max-h-40 shadow-sm" />
                )}
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="my-2 flex justify-start">
              <div className="p-3 rounded-2xl bg-gray-200 text-gray-500 animate-pulse">Thinking...</div>
            </div>
          )}

          {/* 👇 This invisible div ensures auto-scroll to bottom */}
          <div ref={messagesEndRef} />
        </div>

        {/* Image Preview */}
        {image && (
          <div className="flex items-center justify-between p-3 sm:p-4 bg-green-50 border-t border-green-100">
            <div className="flex items-center space-x-3">
              <img
                src={URL.createObjectURL(image)}
                alt="Preview"
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover border border-green-200"
              />
              <p className="text-sm text-gray-700 truncate max-w-[150px] sm:max-w-[200px]">{image.name}</p>
            </div>
            <button
              onClick={handleRemoveImage}
              className="p-2 text-red-500 hover:text-red-600 transition"
              title="Remove image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 sm:p-4 border-t border-gray-200 bg-white rounded-b-3xl flex items-center space-x-2 sm:space-x-3"
        >
          <label className="cursor-pointer flex-shrink-0">
            <input
              id="file-input"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-green-50 hover:bg-green-100 rounded-full border border-green-200 text-green-600 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </label>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your health..."
            className="flex-grow px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700 text-sm"
            disabled={isLoading}
          />

          {isSpeechRecognitionSupported && (
            <button
              type="button"
              onClick={handleListen}
              className={`p-2 sm:p-2.5 rounded-full transition-all shadow-md flex-shrink-0 ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v10m0 0a3 3 0 01-3-3V5a3 3 0 016 0v3a3 3 0 01-3 3zm0 0v7m0 0H8m4 0h4" />
              </svg>
            </button>
          )}

          <button
            type="submit"
            className="px-3 sm:px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-full font-medium hover:from-green-700 hover:to-emerald-600 transition-all disabled:opacity-60 shadow-md text-sm flex-shrink-0"
            disabled={isLoading}
          >
            Send
          </button>
        </form>
      </div>
    </>
  );
};

export default AiChatbot;












// import React, { useState, useEffect, useRef } from 'react';
// import ReactMarkdown from 'react-markdown';

// const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
// const isSpeechRecognitionSupported = !!SpeechRecognition;

// const AiChatbot = () => {
//   const [isChatOpen, setIsChatOpen] = useState(false);
//   const [messages, setMessages] = useState([]);
//   const [input, setInput] = useState('');
//   const [image, setImage] = useState(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isListening, setIsListening] = useState(false);
//   const recognitionRef = useRef(null);
  
//   // Ref for the message container to enable auto-scrolling
//   const messagesEndRef = useRef(null);

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   };

//   // Auto-scroll whenever new messages are added
//   useEffect(() => {
//     scrollToBottom();
//   }, [messages, isLoading]);


//   const toggleChat = () => {
//     setIsChatOpen(!isChatOpen);
//   };

//   useEffect(() => {
//     if (!isSpeechRecognitionSupported) return;
//     const recognition = new SpeechRecognition();
//     recognition.continuous = false;
//     recognition.lang = 'en-US';
//     recognition.interimResults = false;
//     recognition.onstart = () => setIsListening(true);
//     recognition.onend = () => setIsListening(false);
//     recognition.onresult = (event) => setInput(event.results[0][0].transcript);
//     recognition.onerror = (event) => {
//       console.error("Speech recognition error:", event.error);
//       setIsListening(false);
//     }
//     recognitionRef.current = recognition;
//   }, []);

//   const handleListen = () => {
//     if (isListening) {
//       recognitionRef.current.stop();
//     } else {
//       recognitionRef.current.start();
//     }
//   };

//   const handleImageChange = (e) => {
//     if (e.target.files[0]) {
//       setImage(e.target.files[0]);
//     }
//   };

//   const handleSendMessage = async (e) => {
//     e.preventDefault();
//     if (!input.trim() && !image) return;
//     const userMessage = { text: input, sender: 'user', image: image ? URL.createObjectURL(image) : null };
//     setMessages(prev => [...prev, userMessage]);
//     setIsLoading(true);
//     const formData = new FormData();
//     formData.append('prompt', input);
//     if (image) {
//       formData.append('image', image);
//     }
//     setInput('');
//     setImage(null);
//     if(document.getElementById('file-input')) {
//       document.getElementById('file-input').value = '';
//     }
//     try {
//       const API_BASE_URL = import.meta.env.VITE_API_URL;
//       const response = await fetch(`${API_BASE_URL}/ai/query`, {
//         method: 'POST',
//         body: formData,
//       });
//       if (!response.ok) throw new Error('Network response was not ok');
//       const data = await response.json();
//       const aiMessage = { text: data.response, sender: 'ai' };
//       setMessages(prev => [...prev, aiMessage]);
//     } catch (error) {
//       console.error("Fetch error:", error);
//       const errorMessage = { text: "Sorry, I'm having trouble connecting. Please try again.", sender: 'ai' };
//       setMessages(prev => [...prev, errorMessage]);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <>
//       {/* Floating Button */}
//       <div className="fixed bottom-6 right-6 z-40">
//         <button
//           onClick={toggleChat}
//           className="bg-blue-600 text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-transform transform hover:scale-110 focus:outline-none"
//           aria-label="Toggle AI Assistant"
//         >
//           {/* SVG Icon */}
//           <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
//         </button>
//       </div>

//       {/* Redesigned Chat Window */}
//       {isChatOpen && (
//         <div className="fixed bottom-24 right-6 z-50 w-[440px] h-[70vh] max-h-[700px] border rounded-2xl shadow-2xl bg-white flex flex-col transition-all duration-300 ease-in-out">
//           {/* Header */}
//           <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-2xl">
//             <div>
//               <h2 className="text-xl font-semibold text-gray-800">Med.AI Assistant</h2>
//               <p className="text-xs text-red-600 font-medium">Disclaimer: This is an AI assistant and not a medical professional.</p>
//             </div>
//             <button onClick={toggleChat} className="text-gray-400 hover:text-gray-600" aria-label="Close chat">
//               <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
//             </button>
//           </div>

//           {/* Message Display Area */}
//           <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
//             {messages.map((msg, index) => (
//               <div key={index} className={`my-3 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
//                 <div className={`prose p-3 rounded-2xl max-w-sm ${msg.sender === 'user' ? 'bg-blue-500 text-white prose-invert' : 'bg-gray-200 text-gray-800'}`}>
//                   {msg.image && <img src={msg.image} alt="User upload" className="rounded-lg mb-2 max-h-48" />}
//                   <ReactMarkdown>{msg.text}</ReactMarkdown>
//                 </div>
//               </div>
//             ))}
//             {isLoading && (<div className="my-3 flex justify-start"><div className="p-3 rounded-2xl max-w-sm bg-gray-200 text-gray-500 animate-pulse">Thinking...</div></div>)}
//             <div ref={messagesEndRef} />
//           </div>

//           {/* Redesigned Input Form */}
//           <form onSubmit={handleSendMessage} className="p-4 border-t flex items-center space-x-3 bg-white rounded-b-2xl">
//             <label htmlFor="file-input" className="p-2 rounded-full text-gray-500 hover:bg-gray-100 cursor-pointer">
//               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
//               <input id="file-input" type="file" accept="image/*" onChange={handleImageChange} className="hidden"/>
//             </label>

//             <div className="flex-grow relative">
//               <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question..." className="w-full p-3 pr-24 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400" disabled={isLoading}/>
//               <div className="absolute inset-y-0 right-0 flex items-center pr-2">
//                 {isSpeechRecognitionSupported && (<button type="button" onClick={handleListen} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-gray-200'}`}><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>)}
//                 <button type="submit" className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300" disabled={isLoading || (!input.trim() && !image)}>
//                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
//                 </button>
//               </div>
//             </div>
//           </form>
//         </div>
//       )}
//     </>
//   );
// };

// export default AiChatbot;







// // frontend/src/components/AiChatbot.jsx

// import React, { useState, useEffect, useRef } from 'react';
// // === 1. IMPORT THE MARKDOWN LIBRARY ===
// import ReactMarkdown from 'react-markdown';

// // Check for browser support for the Web Speech API
// const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
// const isSpeechRecognitionSupported = !!SpeechRecognition;

// const AiChatbot = () => {
//   const [messages, setMessages] = useState([]);
//   const [input, setInput] = useState('');
//   const [image, setImage] = useState(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isListening, setIsListening] = useState(false);
//   const recognitionRef = useRef(null);

//   useEffect(() => {
//     if (!isSpeechRecognitionSupported) {
//       console.log("Speech recognition is not supported in this browser.");
//       return;
//     }

//     const recognition = new SpeechRecognition();
//     recognition.continuous = false;
//     recognition.lang = 'en-US';
//     recognition.interimResults = false;

//     recognition.onstart = () => setIsListening(true);
//     recognition.onend = () => setIsListening(false);
//     recognition.onresult = (event) => setInput(event.results[0][0].transcript);
//     recognition.onerror = (event) => {
//       console.error("Speech recognition error:", event.error);
//       setIsListening(false);
//     }

//     recognitionRef.current = recognition;
//   }, []);

//   const handleListen = () => {
//     if (isListening) {
//       recognitionRef.current.stop();
//     } else {
//       recognitionRef.current.start();
//     }
//   };

//   const handleImageChange = (e) => {
//     if (e.target.files[0]) {
//       setImage(e.target.files[0]);
//     }
//   };

//   const handleSendMessage = async (e) => {
//     e.preventDefault();
//     if (!input.trim() && !image) return;

//     const userMessage = { text: input, sender: 'user', image: image ? URL.createObjectURL(image) : null };
//     setMessages(prev => [...prev, userMessage]);
//     setIsLoading(true);

//     const formData = new FormData();
//     formData.append('prompt', input);
//     if (image) {
//       formData.append('image', image);
//     }

//     setInput('');
//     setImage(null);
//     if(document.getElementById('file-input')) {
//       document.getElementById('file-input').value = '';
//     }

//     try {
//       const API_BASE_URL = import.meta.env.VITE_API_URL;
//       const response = await fetch(`${API_BASE_URL}/ai/query`, {
//         method: 'POST',
//         body: formData,
//       });

//       if (!response.ok) throw new Error('Network response was not ok');

//       const data = await response.json();
//       const aiMessage = { text: data.response, sender: 'ai' };
//       setMessages(prev => [...prev, aiMessage]);

//     } catch (error) {
//       console.error("Fetch error:", error);
//       const errorMessage = { text: "Sorry, I'm having trouble connecting. Please try again.", sender: 'ai' };
//       setMessages(prev => [...prev, errorMessage]);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <div className="max-w-2xl mx-auto my-8 border rounded-lg shadow-lg bg-white">
//       <div className="p-4 border-b">
//         <h2 className="text-xl font-semibold text-gray-800">Med.AI Assistant</h2>
//         <p className="text-sm text-red-600 font-medium mt-1">
//           Disclaimer: This is an AI assistant and not a medical professional. Consult with a doctor for any medical advice.
//         </p>
//       </div>
//       <div className="p-4 h-96 overflow-y-auto bg-gray-50">
//         {messages.map((msg, index) => (
//           <div key={index} className={`my-2 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
//             <div className={`prose p-3 rounded-lg max-w-lg ${msg.sender === 'user' ? 'bg-blue-500 text-white prose-invert' : 'bg-gray-200 text-gray-800'}`}>
//               {msg.image && <img src={msg.image} alt="User upload" className="rounded-md mb-2 max-h-48" />}
              
//               {/* === 2. USE THE ReactMarkdown COMPONENT TO RENDER THE TEXT === */}
//               <ReactMarkdown>{msg.text}</ReactMarkdown>

//             </div>
//           </div>
//         ))}
//         {isLoading && (
//           <div className="my-2 flex justify-start">
//             <div className="p-3 rounded-lg bg-gray-200 text-gray-500 animate-pulse">Thinking...</div>
//           </div>
//         )}
//       </div>
//       <form onSubmit={handleSendMessage} className="p-4 border-t flex items-center space-x-2">
//         <input id="file-input" type="file" accept="image/*" onChange={handleImageChange} className="w-24 text-sm text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
//         <input
//           type="text"
//           value={input}
//           onChange={(e) => setInput(e.target.value)}
//           placeholder="Ask a question or upload an image..."
//           className="flex-grow p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//           disabled={isLoading}
//         />
//         {isSpeechRecognitionSupported && (
//           <button type="button" onClick={handleListen} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
//             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
//             </svg>
//           </button>
//         )}
//         <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300" disabled={isLoading}>
//           Send
//         </button>
//       </form>
//     </div>
//   );
// };

// export default AiChatbot;