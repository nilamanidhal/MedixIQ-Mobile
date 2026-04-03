import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Delete", cancelText = "Cancel", isDanger = false }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
   <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onCancel}></div>
      <div className="relative bg-white w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
        </div>
        <div className="flex border-t border-slate-100 divide-x divide-slate-100">
          <button onClick={onCancel} className="flex-1 py-3.5 text-sm font-semibold text-slate-600 active:bg-slate-50 transition-colors">
            {cancelText || t('common.cancel')}
          </button>
          <button onClick={onConfirm} className={`flex-1 py-3.5 text-sm font-bold active:bg-slate-50 transition-colors ${isDanger ? 'text-red-600' : 'text-blue-600'}`}>
            {confirmText || t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;