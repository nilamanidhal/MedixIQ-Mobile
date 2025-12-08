import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const ContactPage = () => {
  // State for the new message
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState({ message: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  
  // State for the conversation history
  const [conversation, setConversation] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const { token, API_BASE_URL, user } = useAuth();
  const messagesEndRef = useRef(null); // For auto-scrolling

  // Fetch conversation history when the component loads
  useEffect(() => {
    fetchConversation();
  }, []);

  // Auto-scroll to the bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

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
      setStatus({ message: 'You must be logged in to send a message.', type: 'error' });
      return;
    }
    setIsLoading(true);
    setStatus({ message: '', type: '' });
    try {
      // Use the new '/send-message' route
      const response = await axios.post(`${API_BASE_URL}/contact/send-message`, { message });
      setConversation(response.data); // Set the updated conversation from the response
      setMessage(''); // Clear form on success
    } catch (error) {
      const errorMessage = error.response?.data?.errors?.[0]?.msg || 'Failed to send message. Please try again.';
      setStatus({ message: errorMessage, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Query History Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8">
        <div className="p-6 md:p-8 border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900">Contact Support</h1>
          <p className="mt-2 text-lg text-gray-600">
            View your message history below or send a new message to our team.
          </p>
        </div>
        
        {/* Chat Message Display */}
        <div className="p-4 md:p-8 space-y-4 h-96 overflow-y-auto bg-gray-50">
          {historyLoading && <p className="text-center text-gray-500">Loading your history...</p>}
          {historyError && <p className="text-center text-red-500">{historyError}</p>}
          
          {!historyLoading && !historyError && conversation && (
            conversation.messages.length === 0 ? (
              <p className="text-center text-gray-500">You have not submitted any queries yet.</p>
            ) : (
              conversation.messages.map((msg, index) => (
                <div key={index} className={`flex items-start gap-3 ${msg.from === 'Admin' ? 'justify-start' : 'justify-end'}`}>
                  {/* Admin Message */}
                  {msg.from === 'Admin' && (
                    <div className="flex items-start gap-3 max-w-lg">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-semibold text-white shrink-0">A</div>
                      <div className="flex-1 bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm font-bold text-blue-800">Admin Support replied on {formatDate(msg.sentAt)}</p>
                        <p className="text-sm text-gray-800 mt-1">{msg.text}</p>
                      </div>
                    </div>
                  )}
                  {/* User Message */}
                  {msg.from === 'User' && (
                    <div className="flex items-start gap-3 max-w-lg">
                       <div className="flex-1 bg-gray-100 p-3 rounded-lg">
                        <p className="text-sm text-gray-500 font-medium text-right">You wrote on {formatDate(msg.sentAt)}</p>
                        <p className="text-sm text-gray-800 mt-1 text-right">{msg.text}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 shrink-0">U</div>
                    </div>
                  )}
                </div>
              ))
            )
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Send Message Form */}
        <form onSubmit={onSubmit} className="p-6 md:p-8 border-t border-gray-200 space-y-4">
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
              Your Message
            </label>
            <textarea
              name="message"
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows="4"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              placeholder="Type your new message here..."
            ></textarea>
          </div>
          {status.message && (
            <div className={`p-4 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {status.message}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {isLoading ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContactPage;










// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import { useAuth } from '../../contexts/AuthContext';

// const ContactPage = () => {
//   // State for the contact form
//   const [formData, setFormData] = useState({ subject: '', message: '' });
//   const [status, setStatus] = useState({ message: '', type: '' });
//   const [isLoading, setIsLoading] = useState(false);
  
//   // State for the query history
//   const [queries, setQueries] = useState([]);
//   const [historyLoading, setHistoryLoading] = useState(true);
//   const [historyError, setHistoryError] = useState('');

//   const { token, API_BASE_URL } = useAuth();
//   const { subject, message } = formData;

//   // Fetch query history when the component loads
//   useEffect(() => {
//     fetchQueries();
//   }, []);

//   const fetchQueries = async () => {
//     try {
//       setHistoryLoading(true);
//       const response = await axios.get(`${API_BASE_URL}/contact/my-queries`);
//       setQueries(response.data);
//     } catch (err) {
//       setHistoryError('Failed to fetch your query history.');
//       console.error('Fetch queries error:', err);
//     } finally {
//       setHistoryLoading(false);
//     }
//   };

//   const onChange = (e) =>
//     setFormData({ ...formData, [e.target.name]: e.target.value });

//   const onSubmit = async (e) => {
//     e.preventDefault();
//     if (!token) {
//       setStatus({ message: 'You must be logged in to send a message.', type: 'error' });
//       return;
//     }
//     setIsLoading(true);
//     setStatus({ message: '', type: '' });
//     try {
//       const response = await axios.post(`${API_BASE_URL}/contact/submit`, formData);
//       setStatus({ message: response.data.message, type: 'success' });
//       setFormData({ subject: '', message: '' });
//       fetchQueries(); // Refresh the history after submitting a new query
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
//       {/* Contact Form Section */}
//       <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8">
//         <div className="p-6 md:p-8 border-b border-gray-200">
//           <h1 className="text-3xl font-bold text-gray-900">Contact Support</h1>
//           <p className="mt-2 text-lg text-gray-600">
//             Have a question? Fill out the form below and our team will get back to you.
//           </p>
//         </div>
//         <form onSubmit={onSubmit} className="p-6 md:p-8 space-y-6">
//           {/* Form fields... */}
//           <div>
//             <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
//             <input type="text" name="subject" id="subject" value={subject} onChange={onChange} required className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Issue with my reminder alarm" />
//           </div>
//           <div>
//             <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
//             <textarea name="message" id="message" value={message} onChange={onChange} required rows="6" className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Please describe your issue..."></textarea>
//           </div>
//           {status.message && (
//             <div className={`p-4 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
//               {status.message}
//             </div>
//           )}
//           <div className="flex justify-end">
//             <button type="submit" disabled={isLoading} className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400">
//               {isLoading ? 'Sending...' : 'Send Message'}
//             </button>
//           </div>
//         </form>
//       </div>

//       {/* Query History Section */}
//       <div className="space-y-6">
//         <h2 className="text-2xl font-bold text-gray-800 border-b pb-2">Your Query History</h2>
//         {historyLoading && <p className="text-center text-gray-500">Loading your history...</p>}
//         {historyError && <p className="text-center text-red-500">{historyError}</p>}
//         {!historyLoading && !historyError && (
//           queries.length === 0 ? (
//             <p className="text-center text-gray-500">You have not submitted any queries yet.</p>
//           ) : (
//             queries.map((query) => (
//               <div key={query._id} className="bg-white rounded-xl shadow-lg border border-gray-200">
//                 <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
//                   <h3 className="font-semibold text-gray-800">{query.subject}</h3>
//                   <span className={`px-3 py-1 text-xs font-medium rounded-full ${query.status === 'Open' ? 'bg-red-100 text-red-800' : query.status === 'Answered' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{query.status}</span>
//                 </div>
//                 <div className="p-4 space-y-4">
//                   <div className="flex items-start gap-3">
//                     <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 shrink-0">U</div>
//                     <div className="flex-1 bg-gray-100 p-3 rounded-lg">
//                       <p className="text-sm text-gray-500 font-medium">You wrote on {formatDate(query.createdAt)}</p>
//                       <p className="text-sm text-gray-800 mt-1">{query.message}</p>
//                     </div>
//                   </div>
//                   {query.replies.map((reply, index) => (
//                     <div key={index} className="flex items-start gap-3">
//                       <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-semibold text-white shrink-0">A</div>
//                       <div className="flex-1 bg-blue-50 p-3 rounded-lg">
//                         <p className="text-sm font-bold text-blue-800">Admin Support replied on {formatDate(reply.repliedAt)}</p>
//                         <p className="text-sm text-gray-800 mt-1">{reply.text}</p>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             ))
//           )
//         )}
//       </div>
//     </div>
//   );
// };

// export default ContactPage;

