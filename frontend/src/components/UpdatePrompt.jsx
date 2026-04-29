import React, { useState, useEffect } from 'react';
import { DownloadCloud, AlertCircle } from 'lucide-react';
import { remoteConfig } from '../firebase';
import { fetchAndActivate, getString, getBoolean } from "firebase/remote-config";

//  CHANGE THIS STRING EVERY TIME YOU BUILD A NEW APK!
const CURRENT_APP_VERSION = "1.6.0";

const UpdatePrompt = () => {
    const [updateInfo, setUpdateInfo] = useState(null);

    useEffect(() => {
        const checkForUpdate = async () => {
            try {
                // 1. Fetch the latest config from your Firebase Console
                await fetchAndActivate(remoteConfig);

                // 2. Read the variables you set in Step 2
                const latestVersion = getString(remoteConfig, 'latest_version');
                const updateUrl = getString(remoteConfig, 'update_url');
                const releaseNotes = getString(remoteConfig, 'release_notes');
                const isMandatory = getBoolean(remoteConfig, 'is_mandatory');

                // 3. Compare with the app's current version
                if (latestVersion && latestVersion !== CURRENT_APP_VERSION) {
                    setUpdateInfo({ latestVersion, releaseNotes, updateUrl, isMandatory });
                }
            } catch (error) {
                console.error("Firebase Remote Config Error:", error);
            }
        };

        checkForUpdate();
    }, []);

    if (!updateInfo) return null; // App is up to date, hide modal!

    const handleDownload = async () => {
        //  Use standard location routing instead of the Custom Tab
        window.location.href = updateInfo.updateUrl;
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 text-center">
                
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <DownloadCloud size={40} className="text-blue-600" />
                </div>
                
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                    Update Available!
                </h2>
                
                <div className="inline-block bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full mt-2 mb-4">
                    Version {updateInfo.latestVersion}
                </div>

                <div className="bg-blue-50/50 p-4 rounded-2xl text-left mb-6 border border-blue-100">
                    <p className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-1">
                        <AlertCircle size={14} className="text-blue-600"/> What's New:
                    </p>
                    <p className="text-sm text-slate-600 font-medium">
                        {updateInfo.releaseNotes}
                    </p>
                </div>

                <div className="space-y-3">
                    <button 
                        onClick={handleDownload}
                        className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-transform text-lg"
                    >
                        Download Update
                    </button>
                    
                    {/* If it's a critical bug fix, isMandatory hides the 'Later' button */}
                    {!updateInfo.isMandatory && (
                        <button 
                            onClick={() => setUpdateInfo(null)}
                            className="w-full text-slate-400 font-bold py-3 active:scale-95 transition-transform"
                        >
                            Maybe Later
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpdatePrompt;