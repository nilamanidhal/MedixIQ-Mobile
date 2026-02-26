import React, { useState } from 'react';
import QRCode from "react-qr-code";
import { generateWalletCardPDF } from '../utils/pdfGenerator';
import { Download, RefreshCw } from 'lucide-react';

const QRCardDisplay = ({ token, profileData, onTokenRegenerated }) => {
    const [loading, setLoading] = useState(false);

    // 🚨 FORMAT THE DIRECT MEDICAL DATA FOR THE QR CODE 
    // We format it clearly so any basic camera scanner can read it instantly as text.
    const generateRawQRData = () => {
        const contact = profileData?.emergencyContacts?.[0];
        const publicMeds = profileData?.medicines?.filter(m => m.isPublic).map(m => m.name).join(', ') || 'None';
        
        return `🚨 EMERGENCY MEDICAL ID 🚨
Name: ${profileData?.name || 'Unknown'}
Blood Group: ${profileData?.bloodGroup || 'Unknown'}

⚠️ ALLERGIES:
${profileData?.allergies?.join(', ') || 'None known'}

💊 ACTIVE MEDICATIONS:
${publicMeds}

📞 EMERGENCY CONTACT:
Name: ${contact?.name || 'Not set'}
Phone: ${contact?.phone || 'Not set'}`;
    };

    const handleDownloadPDF = async () => {
        await generateWalletCardPDF(profileData, token);
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <h3 className="font-bold text-slate-800 text-lg mb-2">Your Offline QR Card</h3>
            <p className="text-sm text-slate-500 mb-6">Scan with any camera to instantly view critical data offline.</p>

            {/* QR Code Container */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 inline-block">
                <QRCode 
                    id="emergency-qr-code"
                    value={generateRawQRData()} // 👈 PASSING DIRECT TEXT INSTEAD OF A URL
                    size={200} 
                    level="L" // Lower error correction allows for more text capacity
                />
            </div>

            <button 
                onClick={handleDownloadPDF}
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl mb-3 flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
                <Download size={18} /> Download Printable PDF Card
            </button>
        </div>
    );
};

export default QRCardDisplay;












// import React, { useState } from 'react';
// import QRCode from "react-qr-code";
// import axios from 'axios';
// import { useAuth } from '../contexts/AuthContext';
// import { generateWalletCardPDF } from '../utils/pdfGenerator';
// import { Download, RefreshCw, AlertTriangle } from 'lucide-react';

// const QRCardDisplay = ({ token, profileData, onTokenRegenerated }) => {
//     const { token: authToken, API_BASE_URL } = useAuth();
//     const [loading, setLoading] = useState(false);

//     // The URL the QR code will point to
//     const publicUrl = `https://medmind-heathcare.netlify.app/emergency/${token}`; // Change domain to your actual frontend domain if different

//     const handleRegenerate = async () => {
//         if (!window.confirm("WARNING: Regenerating will invalidate all your previously printed QR cards. Continue?")) return;
        
//         setLoading(true);
//         try {
//             const res = await axios.post(`${API_BASE_URL}/emergency/regenerate`, {}, {
//                 headers: { Authorization: `Bearer ${authToken}` }
//             });
//             onTokenRegenerated(res.data.token);
//             alert("New QR Code generated successfully.");
//         } catch (error) {
//             alert("Error regenerating token.");
//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleDownloadPDF = async () => {
//         await generateWalletCardPDF(profileData, token);
//     };

//     return (
//         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
//             <h3 className="font-bold text-slate-800 text-lg mb-2">Your Medical QR Card</h3>
//             <p className="text-sm text-slate-500 mb-6">Scan to view emergency profile. No app needed.</p>

//             {/* QR Code Container (White bg is required for scanning) */}
//             <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 inline-block">
//                 <QRCode 
//                     id="emergency-qr-code"
//                     value={publicUrl} 
//                     size={180} 
//                     level="H" // High error correction
//                 />
//             </div>

//             <button 
//                 onClick={handleDownloadPDF}
//                 className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl mb-3 flex items-center justify-center gap-2 active:scale-95 transition-transform"
//             >
//                 <Download size={18} /> Download Printable PDF Card
//             </button>

//             <button 
//                 onClick={handleRegenerate}
//                 disabled={loading}
//                 className="w-full bg-red-50 text-red-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
//             >
//                 <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> 
//                 {loading ? "Regenerating..." : "Regenerate QR Code"}
//             </button>
//             <p className="text-[10px] text-slate-400 mt-2 flex items-center justify-center gap-1">
//                 <AlertTriangle size={10} /> Regenerating voids old printed cards.
//             </p>
//         </div>
//     );
// };

// export default QRCardDisplay;