import React, { useState, useEffect } from 'react';
import { useMedicines } from '../../hooks/useMedicines';

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
    }
  }, [medicine]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTimeChange = (index, value) => {
    const newTimes = [...formData.times];
    newTimes[index] = value;
    setFormData(prev => ({
      ...prev,
      times: newTimes,
    }));
  };

  const addTimeSlot = () => {
    setFormData(prev => ({
      ...prev,
      times: [...prev.times, ''],
    }));
  };

  const removeTimeSlot = (index) => {
    if (formData.times.length > 1) {
      const newTimes = formData.times.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        times: newTimes,
      }));
    }
  };

  // src/components/medicines/MedicineForm.jsx

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("🖱️ SUBMIT BUTTON CLICKED"); // <--- LOG 1

    setError('');
    setLoading(true);

    // 1. Validation Checks
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      console.log("❌ Date Error");
      setError('End date must be after start date');
      setLoading(false);
      return;
    }

    if (formData.times.some(time => !time.trim())) {
      console.log("❌ Time Error: Empty slot found");
      setError('All time slots must be filled');
      setLoading(false);
      return;
    }

    console.log("✅ Validation Passed. Preparing data...");

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

    console.log("📦 Data to send:", medicineData); // <--- LOG 2

    let result;
    try {
        if (medicine) {
            console.log("🔄 Updating existing medicine...");
            result = await updateMedicine(medicine._id, medicineData);
        } else {
            console.log("➕ Adding new medicine (Calling Hook)...");
            // THIS is the moment it should trigger the Alarm logic
            result = await addMedicine(medicineData); 
        }

        console.log("🏁 Result from Hook:", result); // <--- LOG 3

        if (result.success) {
            if (result.message && result.message.includes('Offline')) {
                alert("Saved locally! We will sync when internet returns.");
            }
            onSuccess();
        } else {
            setError(result.message || 'An error occurred');
        }
    } catch (err) {
        console.error("💥 CRASH in Submit:", err);
        setError('Unexpected error occurred');
    }

    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-20"> {/* mb-20 handles bottom spacing on mobile */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {medicine ? 'Edit Medicine' : 'Add New Medicine'}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 text-gray-500 hover:text-gray-700 text-3xl leading-none"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Medicine Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Medicine Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            placeholder="Enter medicine name"
          />
        </div>

        {/* Dosage */}
        <div>
          <label htmlFor="dose" className="block text-sm font-medium text-gray-700 mb-1">
            Dose *
          </label>
          <input
            type="text"
            id="dose"
            name="dose"
            value={formData.dose}
            onChange={handleChange}
            required
            className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            placeholder="e.g., 1 tablet, 5ml"
          />
        </div>

        {/* Times */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reminder Times *
          </label>
          {formData.times.map((time, index) => (
            <div key={index} className="flex items-center space-x-2 mb-2">
              <input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(index, e.target.value)}
                required
                className="flex-1 px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              />
              {formData.times.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTimeSlot(index)}
                  className="px-3 py-2 text-red-600 hover:text-red-700 font-medium"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addTimeSlot}
            className="mt-2 w-full px-4 py-3 text-blue-600 hover:text-blue-700 font-medium border border-blue-300 rounded-md hover:bg-blue-50"
          >
            + Add Another Time
          </button>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              required
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            />
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              End Date *
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              required
              min={formData.startDate || new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
            maxLength="500"
            className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            placeholder="Additional notes..."
          />
        </div>

        {/* Actions */}
        <div className="flex space-x-4 pt-4 pb-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-sm"
          >
            {loading ? 'Saving...' : medicine ? 'Update Medicine' : 'Add Medicine'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-md transition-colors text-lg shadow-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default MedicineForm;






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

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError('');
//     setLoading(true);

//     // Validation
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

//     let result;
//     if (medicine) {
//       result = await updateMedicine(medicine._id, medicineData);
//     } else {
//       result = await addMedicine(medicineData);
//     }

//     if (result.success) {
//       onSuccess();
//     } else {
//       setError(result.message);
//     }

//     setLoading(false);
//   };

//   return (
//     <div className="bg-white rounded-lg shadow-md p-6">
//       <div className="flex justify-between items-center mb-6">
//         <h2 className="text-2xl font-bold text-gray-900">
//           {medicine ? 'Edit Medicine' : 'Add New Medicine'}
//         </h2>
//         <button
//           onClick={onCancel}
//           className="text-gray-500 hover:text-gray-700 text-2xl"
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
//             className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Enter medicine name"
//           />
//         </div>

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
//             className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="e.g., 1 tablet, 5ml, 500mg"
//           />
//         </div>

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
//                 className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
//             className="mt-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium border border-blue-300 rounded-md hover:bg-blue-50"
//           >
//             + Add Time
//           </button>
//         </div>

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
//               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
//               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             />
//           </div>
//         </div>

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
//             className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             placeholder="Additional notes about the medicine..."
//           />
//           <p className="text-xs text-gray-500 mt-1">{formData.notes.length}/500 characters</p>
//         </div>

//         <div className="flex space-x-4 pt-4">
//           <button
//             type="submit"
//             disabled={loading}
//             className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//           >
//             {loading ? 'Saving...' : medicine ? 'Update Medicine' : 'Add Medicine'}
//           </button>
//           <button
//             type="button"
//             onClick={onCancel}
//             className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
//           >
//             Cancel
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// };

// export default MedicineForm;