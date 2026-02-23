import React, { useState, useEffect } from 'react';
import { AlertTriangle, PhoneCall, CheckCircle } from 'lucide-react';

const EmergencyOverlay = ({ onCancel, onTimeout }) => {
    const [timeLeft, setTimeLeft] = useState(10);

    useEffect(() => {
        // Vibrate phone aggressively
        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500, 200, 500]);
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onTimeout(); // Trigger the SMS!
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [onTimeout]);

    const handleCall112 = () => {
        window.open('tel:112');
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-red-600 flex flex-col items-center justify-center p-6 text-white animate-in zoom-in duration-300">
            <div className="animate-pulse flex flex-col items-center">
                <AlertTriangle size={100} className="mb-4 text-yellow-300" />
                <h1 className="text-4xl font-black uppercase tracking-widest text-center mb-2">
                    Accident<br/>Detected
                </h1>
            </div>

            <p className="text-center text-red-100 text-lg mb-8 mt-4">
                Sending emergency SMS with your location and medical ID in:
            </p>

            {/* Huge Countdown Number */}
            <div className="text-9xl font-black mb-12 tabular-nums">
                {timeLeft}
            </div>

            <div className="w-full space-y-4 max-w-xs">
                {/* Cancel Button */}
                <button 
                    onClick={onCancel}
                    className="w-full bg-white text-red-600 font-black text-xl py-4 rounded-2xl shadow-xl active:scale-95 transition-transform flex justify-center items-center gap-2"
                >
                    <CheckCircle /> I'M OKAY (CANCEL)
                </button>

                {/* Call Emergency Services Button */}
                <button 
                    onClick={handleCall112}
                    className="w-full bg-black/20 border-2 border-white/50 text-white font-bold text-lg py-4 rounded-2xl active:scale-95 transition-transform flex justify-center items-center gap-2"
                >
                    <PhoneCall /> CALL 112 NOW
                </button>
            </div>
        </div>
    );
};

export default EmergencyOverlay;