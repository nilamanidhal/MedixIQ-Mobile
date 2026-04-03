import React, { useState, useEffect } from 'react';
import { useMedicines } from '../../hooks/useMedicines'; // Adjust path if needed (../../hooks)
import MedicineList from '../medicines/MedicineList';     // Adjust path to components/medicines
import MedicineForm from '../medicines/MedicineForm';     // Adjust path to components/medicines

const ActiveMedicines = () => {
  const { fetchMedicines } = useMedicines();
  const [isAdding, setIsAdding] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);

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
    <div className="min-h-full bg-gray-50 pb-24 relative">
      
      {/* --- HEADER --- */}
      <div className="bg-green-200 px-6 pt-10 pb-6 rounded-b-[2.5rem] shadow-sm mb-0 sticky top-0 z-20 border-b border-slate-100">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">My Medicines</h1>
            <p className="text-slate-500 text-sm font-medium">Manage dosages & schedules</p>
          </div>
          {/* Optional: Status Indicator */}
          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">
            Active
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
                    {editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}
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

    </div>
  );
};

export default ActiveMedicines;








// import React, { useState, useEffect } from 'react';
// import { useMedicines } from '../../hooks/useMedicines';
// import LoadingSpinner from '../LoadingSpinner';

// const ActiveMedicines = () => {
//   const { medicines, loading, fetchMedicines } = useMedicines();

//   useEffect(() => {
//     fetchMedicines();
//   }, []);

//   // Filter medicines that are still active (within start and end date)
//   const getActiveMedicines = () => {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0); // ignore time

//     return medicines.filter(medicine => {
//       if (!medicine.duration?.startDate || !medicine.duration?.endDate) return false;

//       const startDate = new Date(medicine.duration.startDate);
//       const endDate = new Date(medicine.duration.endDate);

//       startDate.setHours(0, 0, 0, 0);
//       endDate.setHours(0, 0, 0, 0);

//       // medicine is active if today is within the duration
//       return today >= startDate && today <= endDate;
//     });
//   };

//   if (loading) return <LoadingSpinner />;

//   const activeMedicines = getActiveMedicines();

//   return (
//     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//       <div className="mb-8">
//         <h1 className="text-4xl font-bold text-gray-900 mb-3">Active Medicines 💊</h1>
//         <p className="text-xl text-gray-600">Track your current prescribed medications</p>
//       </div>

//       {activeMedicines.length > 0 ? (
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           {activeMedicines.map((medicine) => (
//             <div
//               key={medicine._id}
//               className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 hover:scale-105"
//             >
//               <div className="flex items-start justify-between mb-4">
//                 <div className="flex items-center">
//                   <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
//                     <span className="text-white font-bold text-xl">💊</span>
//                   </div>
//                   <div className="ml-4">
//                     <h3 className="text-xl font-semibold text-gray-900">{medicine.name}</h3>
//                     <p className="text-sm text-gray-500 font-medium">{medicine.dose}</p>
//                   </div>
//                 </div>
//               </div>

//               <div className="space-y-3 mb-6">
//                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
//                   <span className="text-sm text-gray-600">Daily doses:</span>
//                   <span className="text-sm font-bold text-blue-600">{medicine.times?.length || 0} times</span>
//                 </div>
                
//                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
//                   <span className="text-sm text-gray-600">Start date:</span>
//                   <span className="text-sm font-bold text-green-600">
//                     {medicine.duration?.startDate 
//                       ? new Date(medicine.duration.startDate).toLocaleDateString()
//                       : "Not set"}
//                   </span>
//                 </div>

//                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
//                   <span className="text-sm text-gray-600">End date:</span>
//                   <span className="text-sm font-bold text-purple-600">
//                     {medicine.duration?.endDate 
//                       ? new Date(medicine.duration.endDate).toLocaleDateString()
//                       : "Not set"}
//                   </span>
//                 </div>

//                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
//   <span className="text-sm text-gray-600">Days left:</span>
//   <span className="text-sm font-bold text-red-600">
//     {(() => {
//       if (medicine.duration?.endDate) {
//         const today = new Date();
//         today.setHours(0,0,0,0);
//         const endDate = new Date(medicine.duration.endDate);
//         endDate.setHours(0,0,0,0);

//         const diffTime = endDate - today;
//         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

//         return diffDays >= 0 ? `${diffDays} day(s)` : "Expired";
//       } else {
//         return "Not set";
//       }
//     })()}
//   </span>
// </div>


//                 {medicine.times && medicine.times.length > 0 && (
//                   <div className="p-3 bg-blue-50 rounded-lg">
//                     <span className="text-sm text-gray-600 block mb-2">All doses:</span>
//                     <div className="flex flex-wrap gap-2">
//                       {medicine.times.map((time, index) => (
//                         <span
//                           key={index}
//                           className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
//                         >
//                           {time}
//                         </span>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//               </div>

//               {medicine.notes && (
//                 <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
//                   <p className="text-sm text-gray-700">
//                     <span className="font-medium">Notes:</span> {medicine.notes}
//                   </p>
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>
//       ) : (
//         <div className="text-center py-16">
//           <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
//             <span className="text-6xl">💊</span>
//           </div>
//           <h3 className="text-2xl font-bold text-gray-900 mb-3">No Active Medicines</h3>
//           <p className="text-gray-600 mb-6">Add some medicines to start tracking your medication schedule</p>
//           <button
//             onClick={() => window.location.reload()}
//             className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
//           >
//             Refresh Page
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ActiveMedicines;
