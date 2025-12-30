import React, { useRef, useEffect, useState } from "react";
import { 
  User, Mail, Calendar, LogOut, X, 
  Cloud, CloudOff 
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useMedicines } from "../hooks/useMedicines";
import ConfirmationModal from "./ConfirmationModal"; 

const ProfilePopup = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { medicines } = useMedicines();
  const popupRef = useRef(null);

  // 1. STATE FOR LOGOUT MODAL
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Sync Logic
  const pendingMeds = medicines.filter(m => m.pendingSync).length;
  const isSynced = pendingMeds === 0;

  // Close popup when clicking outside (Only if logout modal is NOT open)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popupRef.current && 
        !popupRef.current.contains(event.target) && 
        !showLogoutConfirm // 👈 Don't close if modal is showing
      ) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, showLogoutConfirm]);

  if (!isOpen || !user) return null;

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    } catch (e) {
        return "Invalid Date";
    }
  };

  return (
    <>
      <div className="absolute top-16 right-5 z-50 w-80 animate-in slide-in-from-top-5 duration-200">
        <div ref={popupRef} className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden ring-1 ring-slate-900/5">
          
          {/* HEADER */}
          <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
            <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-white/20 text-white rounded-full hover:bg-white/30 backdrop-blur-md">
              <X size={16} />
            </button>
            <div className="absolute -bottom-8 left-6">
              <div className="w-16 h-16 rounded-full bg-white p-1 shadow-lg">
                <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-2xl border border-slate-200 overflow-hidden">
                  {user.avatar ? (
                      <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
                  ) : (
                      user.name?.[0]?.toUpperCase() || <User size={28} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BODY */}
          <div className="pt-10 px-6 pb-2">
            
            <div className="mb-5">
              <h3 className="text-xl font-bold text-slate-800 leading-tight">
                {user.name || "User"}
              </h3>
              <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
                <Mail size={14} />
                <span className="truncate">{user.email}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Age</span>
                  <span className="text-sm font-bold text-slate-700">{user.age || "--"}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Gender</span>
                  <span className="text-sm font-bold text-slate-700 capitalize">{user.gender || "--"}</span>
              </div>
            </div>

            <div className="space-y-3 pb-4">
              <div className="flex items-center justify-between text-sm py-2 border-b border-slate-50">
                <div className="flex items-center gap-2 text-slate-500">
                  <Calendar size={16} className="text-blue-500" />
                  <span>Joined MedMind</span>
                </div>
                <span className="font-semibold text-slate-700">
                  {formatDate(user.createdAt)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm py-2">
                <div className="flex items-center gap-2 text-slate-500">
                  {isSynced ? (
                      <Cloud size={16} className="text-emerald-500" />
                  ) : (
                      <CloudOff size={16} className="text-amber-500" />
                  )}
                  <span>Data Sync</span>
                </div>
                <span className={`font-bold text-xs px-2 py-1 rounded-full ${
                    isSynced ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {isSynced ? "Fully Synced" : `${pendingMeds} Pending`}
                </span>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center">
            <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-700">
              Close
            </button>
            
            {/* 2. UPDATE SIGN OUT BUTTON TO TRIGGER MODAL */}
            <button 
              onClick={() => setShowLogoutConfirm(true)} 
              className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* 3. LOGOUT CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={showLogoutConfirm}
        title="Confirm Logout?"
        message="Please ensure your Mobile Data is ON so that any unsynced data is saved to the database. Logging out may clear unsaved local data."
        confirmText="Yes, Logout"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={() => {
            setShowLogoutConfirm(false);
            logout(); // Actually log out
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
};

export default ProfilePopup;