import React, { useState } from 'react';
import { useMedicines } from '../../hooks/useMedicines';
import LoadingSpinner from '../LoadingSpinner'; 
import { scheduleMedicineReminder, cancelAllAlarms } from '../../utils/LocalNotificationManager';

const MedicineList = ({ onEdit }) => {
    const { medicines, loading, deleteMedicine } = useMedicines();
    const [isSyncing, setIsSyncing] = useState(false);

    const handleResyncAlarms = async () => {
        if (medicines.length === 0) return alert("No medicines to sync.");
        if (!window.confirm(`Reset alarms for all ${medicines.length} medicines?`)) return;
        setIsSyncing(true);
        try {
            let count = 0;
            for (const med of medicines) {
                await scheduleMedicineReminder(med);
                count++;
            }
            alert(`✅ Success! Scheduled alarms for ${count} medicines.`);
        } catch (err) { alert("Error syncing alarms."); } 
        finally { setIsSyncing(false); }
    };

    const handleDelete = async (id, name) => {
        if (window.confirm(`Are you sure you want to delete ${name}?`)) {
            await deleteMedicine(id);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try { return new Date(dateString).toLocaleDateString(); } catch { return 'N/A'; }
    };

    const isExpired = (endDate) => {
        if (!endDate) return false;
        return new Date(endDate) < new Date();
    };

    const isActive = (startDate, endDate) => {
        if (!startDate || !endDate) return false;
        const now = new Date();
        return new Date(startDate) <= now && new Date(endDate) >= now;
    };

    if (loading && medicines.length === 0) return <LoadingSpinner text="Loading medicines..." />;

    if (medicines.length === 0) {
        return (
            <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No medicines added yet</h3>
                <p className="text-gray-600">Add your first medicine to start getting reminders</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Your Medicines</h2>
                <div className="flex space-x-2">
                    <button onClick={handleResyncAlarms} disabled={isSyncing} className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-200 flex items-center">
                        {isSyncing ? '⏳ Syncing...' : '🔄 Resync Alarms'}
                    </button>
                    <button onClick={cancelAllAlarms} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-md">⚠️ Clear All</button>
                </div>
            </div>
            
            {medicines.map((medicine) => {
                const times = medicine.times || [];
                const startDate = medicine.duration?.startDate;
                const endDate = medicine.duration?.endDate;
                const expired = isExpired(endDate);
                const active = isActive(startDate, endDate);
                const isOffline = medicine.pendingSync === true;

                return (
                    <div key={medicine._id} className={`bg-white rounded-lg shadow-md p-6 border-l-4 relative ${isOffline ? 'border-gray-400 bg-gray-50' : expired ? 'border-red-400' : 'border-green-400'}`}>
                        
                        {/* Offline Badge */}
                        {isOffline && (
                            <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full flex items-center shadow-sm font-medium border border-yellow-200">
                                ⏳ Waiting for Internet
                            </div>
                        )}

                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                    <h3 className="text-lg font-semibold text-gray-900">{medicine.name || 'Unknown Medicine'}</h3>
                                    {!isOffline && (
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${expired ? 'bg-red-100 text-red-800' : active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {expired ? 'Expired' : active ? 'Active' : 'Upcoming'}
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-600 mt-1"><span className="font-medium">Dose:</span> {medicine.dose || 'N/A'}</p>
                                <div className="mt-2">
                                    <span className="font-medium text-gray-700">Times:</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {times.length > 0 ? times.map((time, index) => (
                                            <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{time}</span>
                                        )) : <span className="text-sm text-gray-500">No times set</span>}
                                    </div>
                                </div>
                                <div className="mt-2 text-sm text-gray-600">
                                    <span className="font-medium">Duration:</span>{' '}
                                    {(startDate && endDate) ? `${formatDate(startDate)} - ${formatDate(endDate)}` : 'N/A'}
                                </div>
                            </div>
                            
                            <div className="flex flex-col space-y-2 ml-4">
                                {/* 🔥 BUTTONS ARE NOW ALWAYS ENABLED */}
                                <button 
                                    onClick={() => onEdit(medicine)} 
                                    className="px-3 py-1 font-medium text-sm border rounded text-blue-600 border-blue-300 hover:bg-blue-50"
                                >
                                    Edit
                                </button>
                                <button 
                                    onClick={() => handleDelete(medicine._id, medicine.name)} 
                                    className="px-3 py-1 font-medium text-sm border rounded text-red-600 border-red-300 hover:bg-red-50"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MedicineList;








// import React from 'react';
// import { useMedicines } from '../../hooks/useMedicines';
// // If you don't have this component, you can replace it with <p>Loading...</p>
// import LoadingSpinner from '../LoadingSpinner'; 

// const MedicineList = ({ onEdit }) => {
//   const { medicines, loading, error, deleteMedicine, networkStatus } = useMedicines();

//   const handleDelete = async (id, name, isOffline) => {
//     if (isOffline) {
//         alert("This item is not synced to the server yet. You cannot delete it until it syncs.");
//         return;
//     }

//     // Check if we are online before allowing delete of server items
//     if (!networkStatus?.connected) {
//         alert("You must be online to delete synced medicines.");
//         return;
//     }

//     if (window.confirm(`Are you sure you want to delete ${name}?`)) {
//       await deleteMedicine(id);
//     }
//   };

//   const formatDate = (dateString) => {
//     return new Date(dateString).toLocaleDateString();
//   };

//   const isExpired = (endDate) => {
//     return new Date(endDate) < new Date();
//   };

//   const isActive = (startDate, endDate) => {
//     const now = new Date();
//     return new Date(startDate) <= now && new Date(endDate) >= now;
//   };

//   if (loading) {
//     return <LoadingSpinner text="Loading medicines..." />;
//   }

//   // Only show error if we have NO medicines to show. 
//   // If we have cached medicines, show them even if there's a background error.
//   if (error && medicines.length === 0) {
//     return (
//       <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
//         Error: {error}
//       </div>
//     );
//   }

//   if (medicines.length === 0) {
//     return (
//       <div className="text-center py-12">
//         <div className="text-gray-400 text-6xl mb-4">💊</div>
//         <h3 className="text-lg font-medium text-gray-900 mb-2">No medicines added yet</h3>
//         <p className="text-gray-600">Add your first medicine to start getting reminders</p>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-4 pb-20"> {/* pb-20 adds space at bottom for mobile scrolling */}
//       <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Medicines</h2>
      
//       {medicines.map((medicine) => {
//         const expired = isExpired(medicine.duration.endDate);
//         const active = isActive(medicine.duration.startDate, medicine.duration.endDate);
//         const isOffline = medicine.pendingSync === true; // Check the flag from our Hook

//         return (
//           <div
//             key={medicine._id}
//             className={`bg-white rounded-lg shadow-md p-6 border-l-4 relative ${
//               isOffline ? 'border-gray-400 bg-gray-50' : // Grey out slightly if offline
//               expired ? 'border-red-400 opacity-75' : 
//               active ? 'border-green-400' : 'border-yellow-400'
//             }`}
//           >
//             {/* OFFLINE BADGE */}
//             {isOffline && (
//                 <div className="absolute top-2 right-2 bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full flex items-center shadow-sm">
//                     <span className="mr-1">☁️⏳</span> Waiting for Sync
//                 </div>
//             )}

//             <div className="flex justify-between items-start">
//               <div className="flex-1">
//                 <div className="flex items-center space-x-3">
//                   <h3 className="text-lg font-semibold text-gray-900">{medicine.name}</h3>
                  
//                   {!isOffline && (
//                       <span className={`px-2 py-1 rounded-full text-xs font-medium ${
//                         expired ? 'bg-red-100 text-red-800' :
//                         active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
//                       }`}>
//                         {expired ? 'Expired' : active ? 'Active' : 'Upcoming'}
//                       </span>
//                   )}
//                 </div>
                
//                 <p className="text-gray-600 mt-1">
//                   <span className="font-medium">Dose:</span> {medicine.dose}
//                 </p>
                
//                 <div className="mt-2">
//                   <span className="font-medium text-gray-700">Times:</span>
//                   <div className="flex flex-wrap gap-2 mt-1">
//                     {medicine.times.map((time, index) => (
//                       <span
//                         key={index}
//                         className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
//                       >
//                         {time}
//                       </span>
//                     ))}
//                   </div>
//                 </div>
                
//                 <div className="mt-2 text-sm text-gray-600">
//                   <span className="font-medium">Duration:</span>{' '}
//                   {formatDate(medicine.duration.startDate)} - {formatDate(medicine.duration.endDate)}
//                 </div>
                
//                 {medicine.notes && (
//                   <div className="mt-2 text-sm text-gray-600">
//                     <span className="font-medium">Notes:</span> {medicine.notes}
//                   </div>
//                 )}
//               </div>
              
//               <div className="flex flex-col space-y-2 ml-4">
//                 {/* Disable Edit if offline to prevent conflicts */}
//                 <button
//                   onClick={() => !isOffline && onEdit(medicine)}
//                   disabled={isOffline}
//                   className={`px-3 py-1 font-medium text-sm border rounded transition-colors ${
//                       isOffline 
//                       ? 'text-gray-400 border-gray-200 cursor-not-allowed' 
//                       : 'text-blue-600 border-blue-300 hover:bg-blue-50'
//                   }`}
//                 >
//                   Edit
//                 </button>
//                 <button
//                   onClick={() => handleDelete(medicine._id, medicine.name, isOffline)}
//                   className={`px-3 py-1 font-medium text-sm border rounded transition-colors ${
//                        isOffline
//                        ? 'text-gray-400 border-gray-200' // Visual cue that delete is disabled
//                        : 'text-red-600 border-red-300 hover:bg-red-50'
//                   }`}
//                 >
//                   Delete
//                 </button>
//               </div>
//             </div>
//           </div>
//         );
//       })}
//     </div>
//   );
// };

// export default MedicineList;
