import React, { useState, useEffect } from 'react';
import { useMedicines } from '../../hooks/useMedicines';
import { useDrugInteraction } from '../../hooks/useDrugInteraction';
import DrugInteractionAlert from '../DrugInteractionAlert';
import localMedicines from '../../data/indianMedicines.json';
import { 
    LuX, LuPlus, LuTrash2, LuClock, LuPill, 
    LuCalendar, LuFileText, LuLoader, LuActivity 
} from "react-icons/lu"; 

// --- SMART SEARCH INPUT (Premium UI) ---
const MedicineSearchInput = ({ value, onChange, onBlur }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const handleInputChange = (e) => {
        const val = e.target.value;
        onChange(e); 

        if (val && val.length > 1) {
            const searchTerm = val.toLowerCase();
            const matches = localMedicines.filter(med => {
                const nameMatch = med.name?.toLowerCase().includes(searchTerm) || false;
                const genericMatch = med.generic?.toLowerCase().includes(searchTerm) || false;
                return nameMatch || genericMatch;
            });
            setSuggestions(matches.slice(0, 5)); 
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = (med) => {
        const fakeEvent = { target: { name: 'name', value: med.name } };
        onChange(fakeEvent); 
        setShowSuggestions(false);
        if (onBlur) onBlur();
    };

    return (
        <div className="relative">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-blue-500 flex-shrink-0">
                    <LuPill size={22} />
                </div>
                <input
                    type="text"
                    name="name"
                    value={value}
                    onChange={handleInputChange}
                    onBlur={(e) => {
                        setTimeout(() => setShowSuggestions(false), 200);
                        if (onBlur) onBlur(); 
                    }}
                    required
                    autoComplete="off"
                    className="flex-1 text-lg font-bold text-slate-800 placeholder-slate-400 outline-none bg-transparent py-2 pr-3"
                    placeholder="e.g. Dolo 650, Pan 40..."
                />
            </div>

            {/* Premium Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-56 overflow-y-auto overflow-hidden">
                    {suggestions.map((med, i) => (
                        <div 
                            key={i} 
                            onMouseDown={() => handleSelectSuggestion(med)} 
                            className="px-5 py-3 border-b border-slate-50 hover:bg-blue-50/50 cursor-pointer transition-colors flex flex-col justify-center"
                        >
                            <p className="font-bold text-slate-800 text-sm">{med.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{med.generic}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- MAIN FORM COMPONENT ---
const MedicineForm = ({ medicine, onCancel, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    dose: '',
    condition: '',
    times: [''],
    startDate: '',
    endDate: '',
    notes: '',
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { medicines, addMedicine, updateMedicine } = useMedicines();
  const { checkInteractions, loading: drugLoading, clearCache } = useDrugInteraction();
  const [drugResult, setDrugResult] = useState(null);

  useEffect(() => {
    if (medicine) {
      const startDate = new Date(medicine.duration.startDate).toISOString().split('T')[0];
      const endDate = new Date(medicine.duration.endDate).toISOString().split('T')[0];
      
      setFormData({
        name: medicine.name,
        dose: medicine.dose,
        times: medicine.times,
        condition: medicine.condition || '',
        startDate,
        endDate,
        notes: medicine.notes || '',
      });
    } else {
       setFormData(prev => ({
           ...prev,
           startDate: new Date().toISOString().split('T')[0]
       }));
    }
  }, [medicine]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTimeChange = (index, value) => {
    const newTimes = [...formData.times];
    newTimes[index] = value;
    setFormData(prev => ({ ...prev, times: newTimes }));
  };

  const addTimeSlot = () => setFormData(prev => ({ ...prev, times: [...prev.times, ''] }));
  
  const removeTimeSlot = (index) => {
    if (formData.times.length > 1) {
      const newTimes = formData.times.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, times: newTimes }));
    }
  };

  const handleNameBlur = async () => {
      if (!formData.name.trim() || formData.name.length < 3) return;
      setDrugResult(null);
      const result = await checkInteractions(formData.name, medicines);
      setDrugResult(result);
  };

  const performSave = async () => {
    setLoading(true);
    const medicineData = {
      name: formData.name.trim(),
      dose: formData.dose.trim(),
      times: formData.times.filter(time => time.trim()),
      duration: { startDate: formData.startDate, endDate: formData.endDate },
      condition: formData.condition.trim(),
      notes: formData.notes.trim(),
    };

    try {
        let result = medicine 
            ? await updateMedicine(medicine._id, medicineData)
            : await addMedicine(medicineData); 

        if (result.success) {
            if (result.message && result.message.includes('Offline')) {
                alert("Saved locally! We will sync when internet returns.");
            }
            clearCache(); 
            onSuccess();
        } else {
            setError(result.message || 'An error occurred');
        }
    } catch (err) {
        console.error("Crash in Submit:", err);
        setError('Unexpected error occurred');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setError('End date must be after start date');
      return;
    }
    if (formData.times.some(time => !time.trim())) {
      setError('All time slots must be filled');
      return;
    }

    const result = await checkInteractions(formData.name, medicines);
    setDrugResult(result);

    if (result?.status === 'DANGER') return; 

    await performSave();
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-slate-50 flex flex-col h-full w-full animate-in slide-in-from-bottom-10 duration-300">
      
      {/* --- NATIVE APP HEADER --- */}
      <div 
        className="flex justify-between items-center px-5 pb-4 bg-white sticky top-0 z-20 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 24px)' }} // 👈 THIS IS THE MAGIC FIX
      >
        <div className="w-10"></div> {/* Spacer for centering */}
        <div className="text-center mt-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {medicine ? 'Edit Medicine' : 'New Medicine'}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">MedixIQ Tracker</p>
        </div>
        <button
          onClick={onCancel}
          className="w-10 h-10 mt-2 flex items-center justify-center bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
        >
          <LuX size={20} />
        </button>
      </div>

      {/* --- CONTENT --- */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-32 space-y-6">
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm font-bold flex items-center shadow-sm animate-in slide-in-from-top-2">
             <LuX className="mr-2 flex-shrink-0" size={18} /> {error}
          </div>
        )}

        <form id="med-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. MEDICINE DETAILS CARD */}
            <div className="bg-white p-5 rounded-3xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100/60 space-y-5">
                
                {/* Search / Name */}
                <div>
                    <label className="text-[13px] font-bold text-slate-700 mb-2 block">Medicine Name</label>
                    <MedicineSearchInput 
                        value={formData.name}
                        onChange={handleChange}
                        onBlur={handleNameBlur} 
                    />
                    
                    {/* Premium AI Loading State */}
                    {drugLoading && (
                        <div className="text-xs text-indigo-600 font-bold flex items-center gap-2 mt-3 px-2 py-2 bg-indigo-50/50 rounded-lg animate-pulse">
                            <LuActivity className="animate-spin" size={16} />
                            Analyzing clinical interactions...
                        </div>
                    )}

                    {/* AI Alert Component */}
                    <div className="mt-3">
                        <DrugInteractionAlert
                            result={drugResult}
                            onDismiss={() => {
                                setDrugResult(null);
                                performSave();
                            }}
                        />
                    </div>
                </div>

                {/* Treats Condition */}
                <div className="border-t border-slate-100 pt-5">
                    <label className="text-[13px] font-bold text-slate-700 mb-2 block flex items-center justify-between">
                        Treats Condition 
                        <span className="text-[10px] text-slate-400 font-normal bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                    </label>
                    <input
                        type="text"
                        name="condition"
                        value={formData.condition}
                        onChange={handleChange}
                        className="w-full text-sm font-bold text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl p-3.5 transition-all outline-none"
                        placeholder="e.g. Blood Pressure, Diabetes, Fever"
                    />
                </div>

                {/* Dosage */}
                <div className="border-t border-slate-100 pt-5">
                    <label className="text-[13px] font-bold text-slate-700 mb-2 block">Prescribed Dosage</label>
                    <input
                        type="text"
                        name="dose"
                        value={formData.dose}
                        onChange={handleChange}
                        required
                        className="w-full text-sm font-bold text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl p-3.5 transition-all outline-none"
                        placeholder="e.g. 1 Tablet after lunch"
                    />
                </div>
            </div>

            {/* 2. REMINDER TIMES CARD */}
            <div className="bg-white p-5 rounded-3xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100/60">
                <label className="text-[13px] font-bold text-slate-700 mb-4 flex items-center">
                    <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mr-2">
                        <LuClock size={14} />
                    </div>
                    Daily Reminder Times
                </label>
                
                <div className="space-y-3">
                    {formData.times.map((time, index) => (
                    <div key={index} className="flex items-center space-x-3 group">
                        <div className="flex-1 relative">
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => handleTimeChange(index, e.target.value)}
                                required
                                className="w-full bg-slate-50 text-slate-900 font-bold rounded-xl px-4 py-3.5 outline-none border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none text-center text-lg tracking-wider"
                            />
                        </div>
                        {formData.times.length > 1 && (
                            <button 
                                type="button" 
                                onClick={() => removeTimeSlot(index)} 
                                className="w-12 h-12 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
                            >
                                <LuTrash2 size={20} />
                            </button>
                        )}
                    </div>
                    ))}
                    <button
                        type="button"
                        onClick={addTimeSlot}
                        className="w-full py-3.5 mt-2 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <LuPlus size={18} /> Add Another Dose Time
                    </button>
                </div>
            </div>

            {/* 3. DURATION DATES CARD */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-3xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100/60">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <LuCalendar size={14}/> Start Date
                    </label>
                    <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full bg-slate-50 text-slate-800 font-bold rounded-xl px-2 py-3 border border-slate-200 focus:border-blue-500 outline-none text-sm"
                    />
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100/60">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <LuCalendar size={14}/> End Date
                    </label>
                    <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        required
                        min={formData.startDate || new Date().toISOString().split('T')[0]}
                        className="w-full bg-slate-50 text-slate-800 font-bold rounded-xl px-2 py-3 border border-slate-200 focus:border-blue-500 outline-none text-sm"
                    />
                </div>
            </div>

            {/* 4. DOCTOR NOTES CARD */}
            <div className="bg-white p-5 rounded-3xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100/60">
                <label className="text-[13px] font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                    <LuFileText className="text-slate-400" /> Doctor's Instructions
                </label>
                <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows="3"
                    className="w-full text-sm font-medium text-slate-700 placeholder-slate-400 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl p-3.5 transition-all outline-none resize-none"
                    placeholder="E.g. Take with warm water, avoid dairy..."
                />
            </div>
        </form>
      </div>

      {/* --- FLOATING BOTTOM ACTION BAR --- */}
      <div className="p-5 bg-white border-t border-slate-100/50 sticky bottom-0 z-20 safe-area-bottom shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        <button
            type="submit"
            form="med-form"
            disabled={loading || drugLoading}
            className="w-full bg-slate-900 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
        >
            {loading || drugLoading ? (
                <><LuLoader className="animate-spin" size={20}/> Processing...</>
            ) : (
                'Save Medicine'
            )}
        </button>
      </div>

    </div>
  );
};

export default MedicineForm;





















// import React, { useState, useEffect } from 'react';
// import { useMedicines } from '../../hooks/useMedicines';
// import { useDrugInteraction } from '../../hooks/useDrugInteraction';
// import DrugInteractionAlert from '../DrugInteractionAlert';
// import localMedicines from '../../data/indianMedicines.json';
// import { 
//     LuX, LuPlus, LuTrash2, LuClock, LuPill, 
//     LuCalendar, LuFileText, LuLoader 
// } from "react-icons/lu"; 

// // --- SMART SEARCH INPUT (Local Auto-Complete Only) ---
// const MedicineSearchInput = ({ value, onChange, onBlur }) => {
//     const [suggestions, setSuggestions] = useState([]);
//     const [showSuggestions, setShowSuggestions] = useState(false);

//     // 🔍 Filter JSON while typing
//     const handleInputChange = (e) => {
//         const val = e.target.value;
//         onChange(e); // Update parent state

//         if (val && val.length > 1) {
//             const searchTerm = val.toLowerCase();
//             const matches = localMedicines.filter(med => {
//                 const nameMatch = med.name?.toLowerCase().includes(searchTerm) || false;
//                 const genericMatch = med.generic?.toLowerCase().includes(searchTerm) || false;
//                 return nameMatch || genericMatch;
//             });
//             setSuggestions(matches.slice(0, 5)); // Show top 5 matches
//             setShowSuggestions(true);
//         } else {
//             setSuggestions([]);
//             setShowSuggestions(false);
//         }
//     };

//     // 👉 User clicks a dropdown suggestion
//     const handleSelectSuggestion = (med) => {
//         const fakeEvent = { target: { name: 'name', value: med.name } };
//         onChange(fakeEvent); 
//         setShowSuggestions(false);
        
//         // Immediately trigger the AI check in the parent
//         if (onBlur) onBlur();
//     };

//     return (
//         <div className="relative">
//             <div className="flex items-center space-x-3">
//                 <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
//                     <LuPill size={20} />
//                 </div>
//                 <input
//                     type="text"
//                     name="name"
//                     value={value}
//                     onChange={handleInputChange}
//                     onBlur={(e) => {
//                         // Delay hiding suggestions so click can register
//                         setTimeout(() => setShowSuggestions(false), 200);
//                         if (onBlur) onBlur(); // Trigger parent's AI check
//                     }}
//                     required
//                     autoComplete="off"
//                     className="flex-1 text-lg font-semibold text-slate-800 placeholder-slate-300 outline-none bg-transparent"
//                     placeholder="Type 'Dolo', 'Pan 40'..."
//                 />
//             </div>

//             {/* 👇 LOCAL DROPDOWN SUGGESTIONS */}
//             {showSuggestions && suggestions.length > 0 && (
//                 <div className="absolute top-full left-12 right-0 z-50 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
//                     {suggestions.map((med, i) => (
//                         <div 
//                             key={i} 
//                             onMouseDown={() => handleSelectSuggestion(med)} 
//                             className="px-4 py-3 border-b border-slate-50 hover:bg-blue-50 cursor-pointer transition-colors"
//                         >
//                             <p className="font-bold text-slate-700 text-sm">{med.name}</p>
//                             <p className="text-xs text-slate-500">{med.generic}</p>
//                         </div>
//                     ))}
//                 </div>
//             )}
//         </div>
//     );
// };

// // --- MAIN FORM COMPONENT ---
// const MedicineForm = ({ medicine, onCancel, onSuccess }) => {
//   const [formData, setFormData] = useState({
//     name: '',
//     dose: '',
//     condition: '',
//     times: [''],
//     startDate: '',
//     endDate: '',
//     notes: '',
//   });
  
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
  
//   // Hooks
//   const { medicines, addMedicine, updateMedicine } = useMedicines();
//   const { checkInteractions, loading: drugLoading, clearCache } = useDrugInteraction();
//   const [drugResult, setDrugResult] = useState(null);

//   // Load existing medicine data if editing
//   useEffect(() => {
//     if (medicine) {
//       const startDate = new Date(medicine.duration.startDate).toISOString().split('T')[0];
//       const endDate = new Date(medicine.duration.endDate).toISOString().split('T')[0];
      
//       setFormData({
//         name: medicine.name,
//         dose: medicine.dose,
//         times: medicine.times,
//         condition: medicine.condition || '',
//         startDate,
//         endDate,
//         notes: medicine.notes || '',
//       });
//     } else {
//        setFormData(prev => ({
//            ...prev,
//            startDate: new Date().toISOString().split('T')[0]
//        }));
//     }
//   }, [medicine]);

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({ ...prev, [name]: value }));
//   };

//   const handleTimeChange = (index, value) => {
//     const newTimes = [...formData.times];
//     newTimes[index] = value;
//     setFormData(prev => ({ ...prev, times: newTimes }));
//   };

//   const addTimeSlot = () => {
//     setFormData(prev => ({ ...prev, times: [...prev.times, ''] }));
//   };

//   const removeTimeSlot = (index) => {
//     if (formData.times.length > 1) {
//       const newTimes = formData.times.filter((_, i) => i !== index);
//       setFormData(prev => ({ ...prev, times: newTimes }));
//     }
//   };

//   // 🟢 AI Check on Blur (when user leaves input)
//   const handleNameBlur = async () => {
//       if (!formData.name.trim() || formData.name.length < 3) return;
//       setDrugResult(null);
//       const result = await checkInteractions(formData.name, medicines);
//       setDrugResult(result);
//   };

//   // 🟢 Final Database Save Logic
//   const performSave = async () => {
//     setLoading(true);
//     const medicineData = {
//       name: formData.name.trim(),
//       dose: formData.dose.trim(),
//       times: formData.times.filter(time => time.trim()),
//       duration: {
//         startDate: formData.startDate,
//         endDate: formData.endDate,
//       },
//       condition: formData.condition.trim(),
//       notes: formData.notes.trim(),
//     };

//     try {
//         let result;
//         if (medicine) {
//             result = await updateMedicine(medicine._id, medicineData);
//         } else {
//             result = await addMedicine(medicineData); 
//         }

//         if (result.success) {
//             if (result.message && result.message.includes('Offline')) {
//                 alert("Saved locally! We will sync when internet returns.");
//             }
//             clearCache(); // Clean cache so next additions are fresh
//             onSuccess();
//         } else {
//             setError(result.message || 'An error occurred');
//         }
//     } catch (err) {
//         console.error("Crash in Submit:", err);
//         setError('Unexpected error occurred');
//     }
//     setLoading(false);
//   };

//   // 🟢 Intercepted Submit
//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError('');

//     // Validations
//     if (new Date(formData.endDate) <= new Date(formData.startDate)) {
//       setError('End date must be after start date');
//       return;
//     }
//     if (formData.times.some(time => !time.trim())) {
//       setError('All time slots must be filled');
//       return;
//     }

//     // Final AI safety check before saving
//     const result = await checkInteractions(formData.name, medicines);
//     setDrugResult(result);

//     // If DANGER is detected, STOP saving. Allow user to read the warning.
//     if (result?.status === 'DANGER') {
//         return; 
//     }

//     // If SAFE or ERROR (offline), proceed to save
//     await performSave();
//   };

//   return (
//     <div className="fixed inset-0 z-[5000] bg-white flex flex-col h-full w-full animate-in slide-in-from-bottom-10 duration-200">
      
//       {/* --- HEADER --- */}
//       <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-10 shadow-sm">
//         <div>
//             <h2 className="text-xl font-bold text-slate-900">
//               {medicine ? 'Edit Medicine' : 'New Medicine'}
//             </h2>
//             <p className="text-xs text-slate-400 font-medium">Add details & reminders</p>
//         </div>
//         <button
//           onClick={onCancel}
//           className="p-2 bg-slate-50 text-slate-500 rounded-full hover:bg-slate-100 transition-colors"
//         >
//           <LuX size={24} />
//         </button>
//       </div>

//       {/* --- CONTENT --- */}
//       <div className="flex-1 overflow-y-auto p-5 pb-32 bg-slate-50 space-y-5">
        
//         {error && (
//           <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center shadow-sm">
//              <LuX className="mr-2" /> {error}
//           </div>
//         )}

//         <form id="med-form" onSubmit={handleSubmit} className="space-y-5">
            
//             {/* 1. Name & Dosage */}
//             <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
//                 <div>
//                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Medicine Name</label>
//                     <MedicineSearchInput 
//                         value={formData.name}
//                         onChange={handleChange}
//                         onBlur={handleNameBlur} // Triggers AI check
//                     />
                    
//                     {/* Drug check loading state */}
//                     {drugLoading && (
//                         <div className="text-xs text-blue-500 font-bold flex items-center gap-1.5 mt-3 px-1">
//                             <LuLoader className="animate-spin" size={14} />
//                             Checking AI for drug interactions...
//                         </div>
//                     )}

//                     {/* Drug interaction result */}
//                     <div className="mt-3">
//                         <DrugInteractionAlert
//                             result={drugResult}
//                             onDismiss={() => {
//                                 setDrugResult(null);
//                                 performSave(); // Save despite the warning
//                             }}
//                         />
//                     </div>
//                 </div>

//                 {/* Treats Condition */}
//                 <div className="border-t border-slate-50 pt-3">
//                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
//                         Treats Condition <span className="text-[10px] text-slate-300 normal-case">(Optional)</span>
//                     </label>
//                     <input
//                         type="text"
//                         name="condition"
//                         value={formData.condition}
//                         onChange={handleChange}
//                         className="w-full text-sm font-bold text-slate-700 placeholder-slate-300 outline-none bg-slate-50 p-3 rounded-xl"
//                         placeholder="e.g. Hypertension, Diabetes, Pain"
//                     />
//                     <p className="text-[10px] text-blue-400 mt-1 pl-1">
//                         * Helps AI predict risks if you miss doses.
//                     </p>
//                 </div>

//                 <div className="border-t border-slate-50 pt-3">
//                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Dosage</label>
//                     <input
//                         type="text"
//                         name="dose"
//                         value={formData.dose}
//                         onChange={handleChange}
//                         required
//                         className="w-full text-lg font-semibold text-slate-800 placeholder-slate-300 outline-none bg-transparent"
//                         placeholder="e.g. 1 Tablet after food"
//                     />
//                 </div>
//             </div>

//             {/* 2. Times */}
//             <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
//                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block flex items-center">
//                     <LuClock className="mr-1.5" /> Reminder Times
//                 </label>
//                 <div className="space-y-3">
//                     {formData.times.map((time, index) => (
//                     <div key={index} className="flex items-center space-x-3">
//                         <input
//                             type="time"
//                             value={time}
//                             onChange={(e) => handleTimeChange(index, e.target.value)}
//                             required
//                             className="flex-1 bg-slate-50 text-slate-900 font-bold rounded-xl px-4 py-3 outline-none border border-transparent focus:border-blue-500 focus:bg-white transition-all appearance-none"
//                         />
//                         {formData.times.length > 1 && (
//                             <button type="button" onClick={() => removeTimeSlot(index)} className="p-3 text-red-400 hover:text-red-600 bg-red-50 rounded-xl transition-colors">
//                                 <LuTrash2 size={20} />
//                             </button>
//                         )}
//                     </div>
//                     ))}
//                     <button
//                         type="button"
//                         onClick={addTimeSlot}
//                         className="w-full py-3 border-2 border-dashed border-blue-200 text-blue-500 font-bold rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
//                     >
//                         <LuPlus size={18} /> Add Time
//                     </button>
//                 </div>
//             </div>

//             {/* 3. Dates */}
//             <div className="grid grid-cols-2 gap-4">
//                 <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
//                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
//                         <LuCalendar /> Start Date
//                     </label>
//                     <input
//                         type="date"
//                         name="startDate"
//                         value={formData.startDate}
//                         onChange={handleChange}
//                         required
//                         min={new Date().toISOString().split('T')[0]}
//                         className="w-full bg-slate-50 text-slate-900 font-bold rounded-xl px-3 py-2 outline-none text-sm min-h-[42px]"
//                     />
//                 </div>
//                 <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
//                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
//                         <LuCalendar /> End Date
//                     </label>
//                     <input
//                         type="date"
//                         name="endDate"
//                         value={formData.endDate}
//                         onChange={handleChange}
//                         required
//                         min={formData.startDate || new Date().toISOString().split('T')[0]}
//                         className="w-full bg-slate-50 text-slate-900 font-bold rounded-xl px-3 py-2 outline-none text-sm min-h-[42px]"
//                     />
//                 </div>
//             </div>

//             {/* 4. Notes */}
//             <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
//                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
//                     <LuFileText /> Notes
//                 </label>
//                 <textarea
//                     name="notes"
//                     value={formData.notes}
//                     onChange={handleChange}
//                     rows="3"
//                     className="w-full text-sm font-medium text-slate-700 placeholder-slate-300 outline-none bg-transparent resize-none border-none p-0"
//                     placeholder="Optional notes..."
//                 />
//             </div>
//         </form>
//       </div>

//       {/* --- FOOTER --- */}
//       <div className="p-5 border-t border-slate-100 bg-white sticky bottom-0 z-20 safe-area-bottom shadow-[0_-5px_20px_rgb(0,0,0,0.05)]">
//         <button
//             type="submit"
//             form="med-form"
//             disabled={loading || drugLoading}
//             className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
//         >
//             {loading || drugLoading ? 'Processing...' : 'Save Medicine'}
//         </button>
//       </div>

//     </div>
//   );
// };

// export default MedicineForm;
