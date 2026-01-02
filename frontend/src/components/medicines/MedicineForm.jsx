import React, { useState, useEffect } from 'react';
import { useMedicines } from '../../hooks/useMedicines';
import { useDrugInteraction } from '../../hooks/useDrugInteraction';
import localMedicines from '../../data/indianMedicines.json'; // 👈 Using your JSON directly
import { 
    LuX, LuPlus, LuTrash2, LuClock, LuPill, 
    LuCalendar, LuFileText, LuInfo, LuCheck, LuLoader 
} from "react-icons/lu"; 

// --- SMART SEARCH INPUT (Local Auto-Complete + AI Check) ---
const MedicineSearchInput = ({ value, onChange, onSelect }) => {
    const { checkInteractions, loading } = useDrugInteraction(); // Only using AI for SAFETY check
    const { medicines } = useMedicines(); 
    
    // UI States
    const [suggestions, setSuggestions] = useState([]); // Local suggestions
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [warning, setWarning] = useState(null);
    const [safetyMessage, setSafetyMessage] = useState(null);

    // 🔍 1. Filter JSON while typing
    const handleInputChange = (e) => {
       const val = e.target.value;
    onChange(e); // Update parent state

    if (val && val.length > 1) {
        const searchTerm = val.toLowerCase();

        // 🟢 FIX: Added optional chaining (?.) and fallback empty strings ("")
        const matches = localMedicines.filter(med => {
            const nameMatch = med.name?.toLowerCase().includes(searchTerm) || false;
            const genericMatch = med.generic?.toLowerCase().includes(searchTerm) || false;
            return nameMatch || genericMatch;
        });
            setSuggestions(matches.slice(0, 5)); // Show top 5 matches
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    // 🟢 2. Run AI Safety Check (Triggered on Select or Blur)
    const runSafetyCheck = async (name) => {
        if (!name || name.length < 3) return;

        setSafetyMessage(null);
        setWarning(null);

        const validExistingMeds = medicines.filter(m => m.isActive && !m.isPaused);
        
        if (validExistingMeds.length > 0) {
             console.log(`🤖 AI Checking: "${name}" against ${validExistingMeds.length} meds...`);
             const alerts = await checkInteractions(name, medicines);

             if (alerts && alerts.length > 0) {
                 setWarning(alerts[0]); 
             } else {
                 setSafetyMessage("AI Analysis: Safe to take.");
             }
        } else {
            setSafetyMessage("First medicine. No interactions.");
        }
    };

    // 👉 User clicks a dropdown suggestion
    const handleSelectSuggestion = (med) => {
        // Update input with the Brand Name
        const fakeEvent = { target: { name: 'name', value: med.name } };
        onChange(fakeEvent); 
        
        setShowSuggestions(false);
        
        // Immediately run safety check on the selected name
        runSafetyCheck(med.name);
    };

    return (
        <div className="relative">
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
                    <LuPill size={20} />
                </div>
                <input
                    type="text"
                    name="name"
                    value={value}
                    onChange={handleInputChange}
                    onBlur={(e) => {
                        // Delay hiding suggestions so click can register
                        setTimeout(() => setShowSuggestions(false), 200);
                        runSafetyCheck(e.target.value);
                    }}
                    required
                    autoComplete="off"
                    className="flex-1 text-lg font-semibold text-slate-800 placeholder-slate-300 outline-none bg-transparent"
                    placeholder="Type 'Dolo', 'Pan 40'..."
                />
                {loading && <LuLoader className="animate-spin text-blue-500" />}
            </div>

            {/* 🟢 SAFE MESSAGE */}
            {safetyMessage && !warning && !loading && (
                <div className="mt-2 text-xs font-bold text-green-600 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                    <LuCheck size={14} /> {safetyMessage}
                </div>
            )}

            {/* 🔴 DANGER ALERT */}
            {warning && (
                <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl flex gap-3 animate-in slide-in-from-top-2">
                    <LuInfo className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                        <h4 className="text-sm font-bold text-red-700">Interaction Alert</h4>
                        <p className="text-xs text-red-600 leading-relaxed mt-1">
                            Taking <b>{warning.drug1}</b> with <b>{warning.drug2}</b> ({warning.severity} Risk).
                            <br/>
                            <span className="opacity-75 italic">{warning.description}</span>
                        </p>
                    </div>
                </div>
            )}

            {/* 👇 LOCAL DROPDOWN SUGGESTIONS */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-12 right-0 z-50 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {suggestions.map((med, i) => (
                        <div 
                            key={i} 
                            onMouseDown={() => handleSelectSuggestion(med)} 
                            className="px-4 py-3 border-b border-slate-50 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                            <p className="font-bold text-slate-700 text-sm">{med.name}</p>
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
    times: [''],
    startDate: '',
    endDate: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { addMedicine, updateMedicine } = useMedicines();

  useEffect(() => {
    if (medicine) {
      const startDate = new Date(medicine.duration.startDate).toISOString().split('T')[0];
      const endDate = new Date(medicine.duration.endDate).toISOString().split('T')[0];
      
      setFormData({
        name: medicine.name,
        dose: medicine.dose,
        times: medicine.times,
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

  const addTimeSlot = () => {
    setFormData(prev => ({ ...prev, times: [...prev.times, ''] }));
  };

  const removeTimeSlot = (index) => {
    if (formData.times.length > 1) {
      const newTimes = formData.times.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, times: newTimes }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setError('End date must be after start date');
      setLoading(false);
      return;
    }

    if (formData.times.some(time => !time.trim())) {
      setError('All time slots must be filled');
      setLoading(false);
      return;
    }

    const medicineData = {
      name: formData.name.trim(),
      dose: formData.dose.trim(),
      times: formData.times.filter(time => time.trim()),
      duration: {
        startDate: formData.startDate,
        endDate: formData.endDate,
      },
      notes: formData.notes.trim(),
    };

    try {
        let result;
        if (medicine) {
            result = await updateMedicine(medicine._id, medicineData);
        } else {
            result = await addMedicine(medicineData); 
        }

        if (result.success) {
            if (result.message && result.message.includes('Offline')) {
                alert("Saved locally! We will sync when internet returns.");
            }
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

  return (
    <div className="fixed inset-0 z-[5000] bg-white flex flex-col h-full w-full animate-in slide-in-from-bottom-10 duration-200">
      
      {/* --- HEADER --- */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-10 shadow-sm">
        <div>
            <h2 className="text-xl font-bold text-slate-900">
              {medicine ? 'Edit Medicine' : 'New Medicine'}
            </h2>
            <p className="text-xs text-slate-400 font-medium">Add details & reminders</p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 bg-slate-50 text-slate-500 rounded-full hover:bg-slate-100 transition-colors"
        >
          <LuX size={24} />
        </button>
      </div>

      {/* --- CONTENT --- */}
      <div className="flex-1 overflow-y-auto p-5 pb-32 bg-slate-50 space-y-5">
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center shadow-sm">
             <LuX className="mr-2" /> {error}
          </div>
        )}

        <form id="med-form" onSubmit={handleSubmit} className="space-y-5">
            
            {/* 1. Name (Smart Search) & Dosage */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Medicine Name</label>
                    <MedicineSearchInput 
                        value={formData.name}
                        onChange={handleChange}
                        onSelect={() => {}} 
                    />
                </div>
                <div className="border-t border-slate-50 pt-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Dosage</label>
                    <input
                        type="text"
                        name="dose"
                        value={formData.dose}
                        onChange={handleChange}
                        required
                        className="w-full text-lg font-semibold text-slate-800 placeholder-slate-300 outline-none bg-transparent"
                        placeholder="e.g. 1 Tablet after food"
                    />
                </div>
            </div>

            {/* 2. Times */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block flex items-center">
                    <LuClock className="mr-1.5" /> Reminder Times
                </label>
                <div className="space-y-3">
                    {formData.times.map((time, index) => (
                    <div key={index} className="flex items-center space-x-3">
                        <input
                            type="time"
                            value={time}
                            onChange={(e) => handleTimeChange(index, e.target.value)}
                            required
                            className="flex-1 bg-slate-50 text-slate-900 font-bold rounded-xl px-4 py-3 outline-none border border-transparent focus:border-blue-500 focus:bg-white transition-all appearance-none"
                        />
                        {formData.times.length > 1 && (
                            <button type="button" onClick={() => removeTimeSlot(index)} className="p-3 text-red-400 hover:text-red-600 bg-red-50 rounded-xl transition-colors">
                                <LuTrash2 size={20} />
                            </button>
                        )}
                    </div>
                    ))}
                    <button
                        type="button"
                        onClick={addTimeSlot}
                        className="w-full py-3 border-2 border-dashed border-blue-200 text-blue-500 font-bold rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <LuPlus size={18} /> Add Time
                    </button>
                </div>
            </div>

            {/* 3. Dates */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
                        <LuCalendar /> Start Date
                    </label>
                    <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full bg-slate-50 text-slate-900 font-bold rounded-xl px-3 py-2 outline-none text-sm min-h-[42px]"
                    />
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
                        <LuCalendar /> End Date
                    </label>
                    <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        required
                        min={formData.startDate || new Date().toISOString().split('T')[0]}
                        className="w-full bg-slate-50 text-slate-900 font-bold rounded-xl px-3 py-2 outline-none text-sm min-h-[42px]"
                    />
                </div>
            </div>

            {/* 4. Notes */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
                    <LuFileText /> Notes
                </label>
                <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows="3"
                    className="w-full text-sm font-medium text-slate-700 placeholder-slate-300 outline-none bg-transparent resize-none border-none p-0"
                    placeholder="Optional notes..."
                />
            </div>
        </form>
      </div>

      {/* --- FOOTER --- */}
      <div className="p-5 border-t border-slate-100 bg-white sticky bottom-0 z-20 safe-area-bottom shadow-[0_-5px_20px_rgb(0,0,0,0.05)]">
        <button
            type="submit"
            form="med-form"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
        >
            {loading ? 'Saving...' : 'Save Medicine'}
        </button>
      </div>

    </div>
  );
};

export default MedicineForm;









// import React, { useState, useEffect } from 'react';
// import { useMedicines } from '../../hooks/useMedicines';
// import { useDrugInteraction } from '../hooks/useDrugInteraction';
// import { LuX, LuPlus, LuTrash2, LuClock, LuPill, LuCalendar, LuFileText } from "react-icons/lu";

// const MedicineForm = ({ medicine, onCancel, onSuccess }) => {
//   const [formData, setFormData] = useState({
//     name: '',
//     dose: '',
//     times: [''],
//     startDate: '',
//     endDate: '',
//     notes: '',
//   });
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
//   const { addMedicine, updateMedicine } = useMedicines();

//   useEffect(() => {
//     if (medicine) {
//       const startDate = new Date(medicine.duration.startDate).toISOString().split('T')[0];
//       const endDate = new Date(medicine.duration.endDate).toISOString().split('T')[0];
      
//       setFormData({
//         name: medicine.name,
//         dose: medicine.dose,
//         times: medicine.times,
//         startDate,
//         endDate,
//         notes: medicine.notes || '',
//       });
//     } else {
//        // Set default start date to today for new meds
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

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError('');
//     setLoading(true);

//     // 1. Validation Checks
//     if (new Date(formData.endDate) <= new Date(formData.startDate)) {
//       setError('End date must be after start date');
//       setLoading(false);
//       return;
//     }

//     if (formData.times.some(time => !time.trim())) {
//       setError('All time slots must be filled');
//       setLoading(false);
//       return;
//     }

//     const medicineData = {
//       name: formData.name.trim(),
//       dose: formData.dose.trim(),
//       times: formData.times.filter(time => time.trim()),
//       duration: {
//         startDate: formData.startDate,
//         endDate: formData.endDate,
//       },
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

//   return (
//     // 🛡️ FULL SCREEN NATIVE CONTAINER (Solid White Background)
//     <div className="fixed inset-0 z-[5000] bg-white flex flex-col h-full w-full animate-in slide-in-from-bottom-10 duration-200">
      
//       {/* --- HEADER (Sticky Top) --- */}
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

//       {/* --- SCROLLABLE FORM CONTENT --- */}
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
//                     <div className="flex items-center space-x-3">
//                         <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
//                             <LuPill size={20} />
//                         </div>
//                         <input
//                             type="text"
//                             name="name"
//                             value={formData.name}
//                             onChange={handleChange}
//                             required
//                             className="flex-1 text-lg font-semibold text-slate-800 placeholder-slate-300 outline-none bg-transparent"
//                             placeholder="e.g. Paracetamol"
//                         />
//                     </div>
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

//             {/* 2. Times (HTML Time Input) */}
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

//             {/* 3. Dates (HTML Date Input) */}
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

//       {/* --- FOOTER ACTIONS (Sticky Bottom) --- */}
//       <div className="p-5 border-t border-slate-100 bg-white sticky bottom-0 z-20 safe-area-bottom shadow-[0_-5px_20px_rgb(0,0,0,0.05)]">
//         <button
//             type="submit"
//             form="med-form" // Connects to the form ID above
//             disabled={loading}
//             className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
//         >
//             {loading ? 'Saving Prescription...' : 'Save Medicine'}
//         </button>
//       </div>

//     </div>
//   );
// };

// export default MedicineForm;












// import React, { useState, useEffect } from 'react';
// import { useMedicines } from '../../hooks/useMedicines';

// const MedicineForm = ({ medicine, onCancel, onSuccess }) => {
//   const [formData, setFormData] = useState({
//     name: '',
//     dose: '',
//     times: [''],
//     startDate: '',
//     endDate: '',
//     notes: '',
//   });
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
//   const { addMedicine, updateMedicine } = useMedicines();

//   useEffect(() => {
//     if (medicine) {
//       const startDate = new Date(medicine.duration.startDate).toISOString().split('T')[0];
//       const endDate = new Date(medicine.duration.endDate).toISOString().split('T')[0];
      
//       setFormData({
//         name: medicine.name,
//         dose: medicine.dose,
//         times: medicine.times,
//         startDate,
//         endDate,
//         notes: medicine.notes || '',
//       });
//     }
//   }, [medicine]);

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({
//       ...prev,
//       [name]: value,
//     }));
//   };

//   const handleTimeChange = (index, value) => {
//     const newTimes = [...formData.times];
//     newTimes[index] = value;
//     setFormData(prev => ({
//       ...prev,
//       times: newTimes,
//     }));
//   };

//   const addTimeSlot = () => {
//     setFormData(prev => ({
//       ...prev,
//       times: [...prev.times, ''],
//     }));
//   };

//   const removeTimeSlot = (index) => {
//     if (formData.times.length > 1) {
//       const newTimes = formData.times.filter((_, i) => i !== index);
//       setFormData(prev => ({
//         ...prev,
//         times: newTimes,
//       }));
//     }
//   };

//   // src/components/medicines/MedicineForm.jsx

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     console.log("🖱️ SUBMIT BUTTON CLICKED"); // <--- LOG 1

//     setError('');
//     setLoading(true);

//     // 1. Validation Checks
//     if (new Date(formData.endDate) <= new Date(formData.startDate)) {
//       console.log("❌ Date Error");
//       setError('End date must be after start date');
//       setLoading(false);
//       return;
//     }

//     if (formData.times.some(time => !time.trim())) {
//       console.log("❌ Time Error: Empty slot found");
//       setError('All time slots must be filled');
//       setLoading(false);
//       return;
//     }

//     console.log("✅ Validation Passed. Preparing data...");

//     const medicineData = {
//       name: formData.name.trim(),
//       dose: formData.dose.trim(),
//       times: formData.times.filter(time => time.trim()),
//       duration: {
//         startDate: formData.startDate,
//         endDate: formData.endDate,
//       },
//       notes: formData.notes.trim(),
//     };

//     console.log("📦 Data to send:", medicineData); // <--- LOG 2

//     let result;
//     try {
//         if (medicine) {
//             console.log("🔄 Updating existing medicine...");
//             result = await updateMedicine(medicine._id, medicineData);
//         } else {
//             console.log("➕ Adding new medicine (Calling Hook)...");
//             // THIS is the moment it should trigger the Alarm logic
//             result = await addMedicine(medicineData); 
//         }

//         console.log("🏁 Result from Hook:", result); // <--- LOG 3

//         if (result.success) {
//             if (result.message && result.message.includes('Offline')) {
//                 alert("Saved locally! We will sync when internet returns.");
//             }
//             onSuccess();
//         } else {
//             setError(result.message || 'An error occurred');
//         }
//     } catch (err) {
//         console.error("💥 CRASH in Submit:", err);
//         setError('Unexpected error occurred');
//     }

//     setLoading(false);
//   };

//   return (
//     <div className="bg-white rounded-lg shadow-md p-6 mb-20"> {/* mb-20 handles bottom spacing on mobile */}
//       <div className="flex justify-between items-center mb-6">
//         <h2 className="text-2xl font-bold text-gray-900">
//           {medicine ? 'Edit Medicine' : 'Add New Medicine'}
//         </h2>
//         <button
//           onClick={onCancel}
//           className="p-2 text-gray-500 hover:text-gray-700 text-3xl leading-none"
//         >
//           ×
//         </button>
//       </div>

//       <form onSubmit={handleSubmit} className="space-y-4">
//         {error && (
//           <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
//             {error}
//           </div>
//         )}

//         {/* Medicine Name */}
//         <div>
//           <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
//             Medicine Name *
//           </label>
//           <input
//             type="text"
//             id="name"
//             name="name"
//             value={formData.name}
//             onChange={handleChange}
//             required
//             className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
//             placeholder="Enter medicine name"
//           />
//         </div>

//         {/* Dosage */}
//         <div>
//           <label htmlFor="dose" className="block text-sm font-medium text-gray-700 mb-1">
//             Dose *
//           </label>
//           <input
//             type="text"
//             id="dose"
//             name="dose"
//             value={formData.dose}
//             onChange={handleChange}
//             required
//             className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
//             placeholder="e.g., 1 tablet, 5ml"
//           />
//         </div>

//         {/* Times */}
//         <div>
//           <label className="block text-sm font-medium text-gray-700 mb-1">
//             Reminder Times *
//           </label>
//           {formData.times.map((time, index) => (
//             <div key={index} className="flex items-center space-x-2 mb-2">
//               <input
//                 type="time"
//                 value={time}
//                 onChange={(e) => handleTimeChange(index, e.target.value)}
//                 required
//                 className="flex-1 px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
//               />
//               {formData.times.length > 1 && (
//                 <button
//                   type="button"
//                   onClick={() => removeTimeSlot(index)}
//                   className="px-3 py-2 text-red-600 hover:text-red-700 font-medium"
//                 >
//                   Remove
//                 </button>
//               )}
//             </div>
//           ))}
//           <button
//             type="button"
//             onClick={addTimeSlot}
//             className="mt-2 w-full px-4 py-3 text-blue-600 hover:text-blue-700 font-medium border border-blue-300 rounded-md hover:bg-blue-50"
//           >
//             + Add Another Time
//           </button>
//         </div>

//         {/* Dates */}
//         <div className="grid grid-cols-2 gap-4">
//           <div>
//             <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
//               Start Date *
//             </label>
//             <input
//               type="date"
//               id="startDate"
//               name="startDate"
//               value={formData.startDate}
//               onChange={handleChange}
//               required
//               min={new Date().toISOString().split('T')[0]}
//               className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
//             />
//           </div>

//           <div>
//             <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
//               End Date *
//             </label>
//             <input
//               type="date"
//               id="endDate"
//               name="endDate"
//               value={formData.endDate}
//               onChange={handleChange}
//               required
//               min={formData.startDate || new Date().toISOString().split('T')[0]}
//               className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
//             />
//           </div>
//         </div>

//         {/* Notes */}
//         <div>
//           <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
//             Notes (Optional)
//           </label>
//           <textarea
//             id="notes"
//             name="notes"
//             value={formData.notes}
//             onChange={handleChange}
//             rows="3"
//             maxLength="500"
//             className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
//             placeholder="Additional notes..."
//           />
//         </div>

//         {/* Actions */}
//         <div className="flex space-x-4 pt-4 pb-4">
//           <button
//             type="submit"
//             disabled={loading}
//             className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-sm"
//           >
//             {loading ? 'Saving...' : medicine ? 'Update Medicine' : 'Add Medicine'}
//           </button>
//           <button
//             type="button"
//             onClick={onCancel}
//             className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-md transition-colors text-lg shadow-sm"
//           >
//             Cancel
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// };

// export default MedicineForm;
