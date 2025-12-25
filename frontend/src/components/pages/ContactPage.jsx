import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Send, 
  MessageSquare, 
  User, 
  Headphones, 
  Clock, 
  AlertCircle,
  Loader2 
} from "lucide-react";

const ContactPage = () => {
  // --- STATE & LOGIC (UNCHANGED) ---
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState({ message: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  
  const [conversation, setConversation] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const { token, API_BASE_URL } = useAuth();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversation();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, historyLoading]);

  const fetchConversation = async () => {
    try {
      setHistoryLoading(true);
      const response = await axios.get(`${API_BASE_URL}/contact/my-conversation`);
      setConversation(response.data);
    } catch (err) {
      setHistoryError('Failed to fetch your query history.');
      console.error('Fetch queries error:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || !token) {
      setStatus({ message: 'You must be logged in.', type: 'error' });
      return;
    }
    setIsLoading(true);
    setStatus({ message: '', type: '' });
    try {
      const response = await axios.post(`${API_BASE_URL}/contact/send-message`, { message });
      setConversation(response.data);
      setMessage('');
    } catch (error) {
      const errorMessage = error.response?.data?.errors?.[0]?.msg || 'Failed to send message.';
      setStatus({ message: errorMessage, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (dateString) => {
    return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50">
      
      {/* --- 1. CHAT HEADER --- */}
      <div className="bg-white px-6 py-4 shadow-sm border-b border-slate-200 z-10 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 rounded-full">
            <Headphones className="text-blue-600" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Support Chat</h1>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              <p className="text-xs text-slate-500 font-medium">We typically reply in 24h</p>
            </div>
          </div>
        </div>
      </div>

      {/* --- 2. MESSAGES AREA --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Loading / Error States */}
        {historyLoading && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p className="text-sm">Loading history...</p>
          </div>
        )}
        
        {historyError && (
          <div className="flex items-center justify-center p-4 bg-red-50 text-red-600 rounded-xl mx-auto max-w-sm">
            <AlertCircle size={20} className="mr-2" />
            <p className="text-sm font-medium">{historyError}</p>
          </div>
        )}

        {/* Empty State */}
        {!historyLoading && !historyError && conversation && conversation.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-60">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="text-slate-300" size={40} />
            </div>
            <p className="text-slate-500 font-medium">No messages yet.</p>
            <p className="text-xs text-slate-400 mt-1">Start a conversation with our support team.</p>
          </div>
        )}

        {/* --- CHAT BUBBLES --- */}
        {!historyLoading && conversation?.messages?.map((msg, index) => {
          const isAdmin = msg.from === 'Admin';
          const isUser = msg.from === 'User';
          
          return (
            <div key={index} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[80%] md:max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isUser ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'
                }`}>
                  {isUser ? <User size={16} /> : <Headphones size={16} />}
                </div>

                {/* Bubble */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                    isUser 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                  
                  {/* Timestamp */}
                  <div className="flex items-center mt-1 space-x-1 opacity-60">
                    {/* Only show date if it's the first message or different day */}
                    <span className="text-[10px] font-medium text-slate-400">
                      {formatDateLabel(msg.sentAt)} • {formatTime(msg.sentAt)}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
        
        {/* Invisible div to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* --- 3. INPUT AREA (Sticky Bottom) --- */}
      <div className="bg-white p-4 border-t border-slate-200 sticky bottom-0 z-20">
        <div className="max-w-4xl mx-auto">
          {status.message && (
            <div className={`mb-3 px-4 py-2 rounded-lg text-xs font-medium flex items-center ${
              status.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
            }`}>
              <AlertCircle size={14} className="mr-2" />
              {status.message}
            </div>
          )}
          
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                name="message"
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows="1"
                className="w-full pl-4 pr-4 py-3 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none max-h-32 min-h-[48px]"
                placeholder="Type your message..."
                style={{ height: 'auto', minHeight: '48px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
              ></textarea>
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !message.trim()}
              className={`p-3 rounded-full flex items-center justify-center transition-all ${
                !message.trim() || isLoading 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95'
              }`}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Send size={20} className={message.trim() ? 'ml-0.5' : ''} />
              )}
            </button>
          </form>
        </div>
      </div>

    </div>
  );
};

export default ContactPage;







// import React, { useState, useEffect, useRef } from 'react';
// import axios from 'axios';
// import { useAuth } from '../../contexts/AuthContext';

// const ContactPage = () => {
//   // State for the new message
//   const [message, setMessage] = useState('');
//   const [status, setStatus] = useState({ message: '', type: '' });
//   const [isLoading, setIsLoading] = useState(false);
  
//   // State for the conversation history
//   const [conversation, setConversation] = useState(null);
//   const [historyLoading, setHistoryLoading] = useState(true);
//   const [historyError, setHistoryError] = useState('');

//   const { token, API_BASE_URL, user } = useAuth();
//   const messagesEndRef = useRef(null); // For auto-scrolling

//   // Fetch conversation history when the component loads
//   useEffect(() => {
//     fetchConversation();
//   }, []);

//   // Auto-scroll to the bottom when new messages are added
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [conversation]);

//   const fetchConversation = async () => {
//     try {
//       setHistoryLoading(true);
//       const response = await axios.get(`${API_BASE_URL}/contact/my-conversation`);
//       setConversation(response.data);
//     } catch (err) {
//       setHistoryError('Failed to fetch your query history.');
//       console.error('Fetch queries error:', err);
//     } finally {
//       setHistoryLoading(false);
//     }
//   };

//   const onSubmit = async (e) => {
//     e.preventDefault();
//     if (!message.trim() || !token) {
//       setStatus({ message: 'You must be logged in to send a message.', type: 'error' });
//       return;
//     }
//     setIsLoading(true);
//     setStatus({ message: '', type: '' });
//     try {
//       // Use the new '/send-message' route
//       const response = await axios.post(`${API_BASE_URL}/contact/send-message`, { message });
//       setConversation(response.data); // Set the updated conversation from the response
//       setMessage(''); // Clear form on success
//     } catch (error) {
//       const errorMessage = error.response?.data?.errors?.[0]?.msg || 'Failed to send message. Please try again.';
//       setStatus({ message: errorMessage, type: 'error' });
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const formatDate = (dateString) => {
//     if (!dateString) return '';
//     return new Date(dateString).toLocaleString('en-US', {
//       year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
//     });
//   };

//   return (
//     <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
//       {/* Query History Section */}
//       <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8">
//         <div className="p-6 md:p-8 border-b border-gray-200">
//           <h1 className="text-3xl font-bold text-gray-900">Contact Support</h1>
//           <p className="mt-2 text-lg text-gray-600">
//             View your message history below or send a new message to our team.
//           </p>
//         </div>
        
//         {/* Chat Message Display */}
//         <div className="p-4 md:p-8 space-y-4 h-96 overflow-y-auto bg-gray-50">
//           {historyLoading && <p className="text-center text-gray-500">Loading your history...</p>}
//           {historyError && <p className="text-center text-red-500">{historyError}</p>}
          
//           {!historyLoading && !historyError && conversation && (
//             conversation.messages.length === 0 ? (
//               <p className="text-center text-gray-500">You have not submitted any queries yet.</p>
//             ) : (
//               conversation.messages.map((msg, index) => (
//                 <div key={index} className={`flex items-start gap-3 ${msg.from === 'Admin' ? 'justify-start' : 'justify-end'}`}>
//                   {/* Admin Message */}
//                   {msg.from === 'Admin' && (
//                     <div className="flex items-start gap-3 max-w-lg">
//                       <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-semibold text-white shrink-0">A</div>
//                       <div className="flex-1 bg-blue-50 p-3 rounded-lg">
//                         <p className="text-sm font-bold text-blue-800">Admin Support replied on {formatDate(msg.sentAt)}</p>
//                         <p className="text-sm text-gray-800 mt-1">{msg.text}</p>
//                       </div>
//                     </div>
//                   )}
//                   {/* User Message */}
//                   {msg.from === 'User' && (
//                     <div className="flex items-start gap-3 max-w-lg">
//                        <div className="flex-1 bg-gray-100 p-3 rounded-lg">
//                         <p className="text-sm text-gray-500 font-medium text-right">You wrote on {formatDate(msg.sentAt)}</p>
//                         <p className="text-sm text-gray-800 mt-1 text-right">{msg.text}</p>
//                       </div>
//                       <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 shrink-0">U</div>
//                     </div>
//                   )}
//                 </div>
//               ))
//             )
//           )}
//           <div ref={messagesEndRef} />
//         </div>
        
//         {/* Send Message Form */}
//         <form onSubmit={onSubmit} className="p-6 md:p-8 border-t border-gray-200 space-y-4">
//           <div>
//             <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
//               Your Message
//             </label>
//             <textarea
//               name="message"
//               id="message"
//               value={message}
//               onChange={(e) => setMessage(e.target.value)}
//               required
//               rows="4"
//               className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
//               placeholder="Type your new message here..."
//             ></textarea>
//           </div>
//           {status.message && (
//             <div className={`p-4 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
//               {status.message}
//             </div>
//           )}
//           <div className="flex justify-end">
//             <button
//               type="submit"
//               disabled={isLoading}
//               className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition duration-150 ease-in-out"
//             >
//               {isLoading ? 'Sending...' : 'Send Message'}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// };

// export default ContactPage;
