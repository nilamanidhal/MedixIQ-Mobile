import React, { useState, useEffect } from 'react';
import { useMedicines } from '../../hooks/useMedicines'; // Adjust path if needed (../../hooks)
import MedicineList from '../medicines/MedicineList';     // Adjust path to components/medicines
import MedicineForm from '../medicines/MedicineForm';     // Adjust path to components/medicines
import { useTranslation } from 'react-i18next';

const ActiveMedicines = () => {
  const { fetchMedicines } = useMedicines();
  const [isAdding, setIsAdding] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const { t } = useTranslation();

  // // 1. Refresh data when entering this page
  // useEffect(() => {
  //   fetchMedicines();
  // }, []);

  // 2. Handlers for switching views
  const startAdd = () => {
    setEditingMedicine(null);
    setIsAdding(true);
  };

  const startEdit = (med) => {
    setEditingMedicine(med);
    setIsAdding(true);
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingMedicine(null);
    // fetchMedicines(); 
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-y-auto bg-gray-50 pb-32 font-sans">
      
      {/* --- HEADER --- */}
      <div className="flex-shrink-0 bg-green-200 px-6 pt-14 pb-6 rounded-b-[2.5rem] shadow-sm mb-0 sticky top-0 z-20 border-b border-slate-100">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('medicines.title')}</h1>
            <p className="text-slate-500 text-sm font-medium">{t('medicines.subtitle')}</p>
          </div>
          {/* Optional: Status Indicator */}
          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">
            {t('medicines.active')}
          </div>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="p-4">
        {isAdding ? (
          // VIEW 1: ADD/EDIT FORM
          <div className="bg-white rounded-2xl shadow-lg p-1 animate-fade-in-up">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">
                    {editingMedicine ? t('medicines.form.editMedicine') : t('medicines.form.newMedicine')}
                </h2>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 text-2xl">
                    &times;
                </button>
            </div>
            <MedicineForm 
              medicine={editingMedicine} 
              onCancel={closeForm} 
              onSuccess={closeForm} 
            />
          </div>
        ) : (
          // VIEW 2: LIST OF MEDICINES
          <div className="space-y-4">
             {/* We pass 'startEdit' so the list items can trigger the edit mode */}
             <MedicineList onEdit={startEdit} />
             
             {/* Empty State Spacer */}
             <div className="h-12"></div> 
          </div>
        )}
      </div>

      {/* --- FLOATING ACTION BUTTON (FAB) --- */}
      {/* Only show this button if we are NOT currently adding/editing */}
      {!isAdding && (
        <button 
          onClick={startAdd}
          className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full shadow-xl flex items-center justify-center text-3xl font-light hover:scale-105 active:scale-95 transition-all z-30"
          style={{ boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)' }}
        >
          <span className="mb-1">+</span>
        </button>
      )}

      <div className="h-32 w-full flex-shrink-0 block"></div>

    </div>
  );
};

export default ActiveMedicines;

