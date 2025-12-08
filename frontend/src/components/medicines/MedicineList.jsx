import React from 'react';
import { useMedicines } from '../../hooks/useMedicines';
import LoadingSpinner from '../LoadingSpinner';

const MedicineList = ({ onEdit }) => {
  const { medicines, loading, error, deleteMedicine } = useMedicines();

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      await deleteMedicine(id);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isExpired = (endDate) => {
    return new Date(endDate) < new Date();
  };

  const isActive = (startDate, endDate) => {
    const now = new Date();
    return new Date(startDate) <= now && new Date(endDate) >= now;
  };

  if (loading) {
    return <LoadingSpinner text="Loading medicines..." />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
        Error: {error}
      </div>
    );
  }

  if (medicines.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">💊</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No medicines added yet</h3>
        <p className="text-gray-600">Add your first medicine to start getting reminders</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Medicines</h2>
      
      {medicines.map((medicine) => {
        const expired = isExpired(medicine.duration.endDate);
        const active = isActive(medicine.duration.startDate, medicine.duration.endDate);
        
        return (
          <div
            key={medicine._id}
            className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
              expired ? 'border-red-400 opacity-75' : 
              active ? 'border-green-400' : 'border-yellow-400'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-gray-900">{medicine.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    expired ? 'bg-red-100 text-red-800' :
                    active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {expired ? 'Expired' : active ? 'Active' : 'Upcoming'}
                  </span>
                </div>
                
                <p className="text-gray-600 mt-1">
                  <span className="font-medium">Dose:</span> {medicine.dose}
                </p>
                
                <div className="mt-2">
                  <span className="font-medium text-gray-700">Times:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {medicine.times.map((time, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Duration:</span>{' '}
                  {formatDate(medicine.duration.startDate)} - {formatDate(medicine.duration.endDate)}
                </div>
                
                {medicine.notes && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Notes:</span> {medicine.notes}
                  </div>
                )}
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => onEdit(medicine)}
                  className="px-3 py-1 text-blue-600 hover:text-blue-700 font-medium text-sm border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(medicine._id, medicine.name)}
                  className="px-3 py-1 text-red-600 hover:text-red-700 font-medium text-sm border border-red-300 rounded hover:bg-red-50 transition-colors"
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