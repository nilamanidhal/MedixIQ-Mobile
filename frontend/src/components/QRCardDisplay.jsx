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
