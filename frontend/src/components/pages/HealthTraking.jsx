import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LoadingSpinner from '../LoadingSpinner';

const HealthTracking = () => {
  const [trackingData, setTrackingData] = useState({});
  const [loading, setLoading] = useState(true);

  // ✅ Fetch tracking stats from backend
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('https://medmind-qnpv.onrender.com/api/tracking/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTrackingData(res.data);
      } catch (error) {
        console.error('Error fetching tracking stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getAdherenceColor = (rate) => {
    if (rate >= 90) return 'text-green-600 bg-green-100 border-green-200';
    if (rate >= 75) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getProgressBarColor = (rate) => {
    if (rate >= 90) return 'bg-gradient-to-r from-green-400 to-green-600';
    if (rate >= 75) return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
    return 'bg-gradient-to-r from-red-400 to-red-600';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Health Tracking 📊</h1>
        <p className="text-xl text-gray-600">Monitor your medication progress and adherence patterns</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-2">Overall Adherence</p>
              <p className={`text-3xl font-bold px-4 py-2 rounded-xl border ${getAdherenceColor(trackingData.adherenceRate)}`}>
                {trackingData.adherenceRate}%
              </p>
            </div>
            <div className="text-5xl">📈</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-2">Total Medicines</p>
              <p className="text-3xl font-bold text-blue-600">{trackingData.totalMedicines}</p>
            </div>
            <div className="text-5xl">💊</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-2">Active Now</p>
              <p className="text-3xl font-bold text-green-600">{trackingData.activeMedicines}</p>
            </div>
            <div className="text-5xl">✅</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-2">Weekly Average</p>
              <p className="text-3xl font-bold text-purple-600">
                {trackingData.weeklyProgress
                  ? Math.round(trackingData.weeklyProgress.reduce((a, b) => a + b.rate, 0) / 7)
                  : 0}%
              </p>
            </div>
            <div className="text-5xl">📊</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Progress Chart */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <span className="text-3xl mr-3">📈</span>
              Weekly Progress Chart
            </h2>
            <p className="text-sm text-gray-600 mt-1">Your adherence rate over the last 7 days</p>
          </div>
          <div className="p-6">
            {trackingData.weeklyProgress && (
              <div className="space-y-6">
                {trackingData.weeklyProgress.map((day, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <span className="text-sm font-bold text-gray-700 w-12">{day.day}</span>
                        <span className="text-xs text-gray-500 ml-2">{day.doses} doses</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-bold text-gray-900 mr-3">{day.rate}%</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getAdherenceColor(day.rate)}`}>
                          {day.rate >= 90 ? 'Excellent' : day.rate >= 75 ? 'Good' : 'Needs Work'}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-4 rounded-full transition-all duration-1000 ease-out ${getProgressBarColor(day.rate)}`}
                        style={{ width: `${day.rate}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Medicine Breakdown */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <span className="text-3xl mr-3">💊</span>
              Medicine Performance
            </h2>
            <p className="text-sm text-gray-600 mt-1">Individual adherence rates for each medicine</p>
          </div>
          <div className="p-6">
            {trackingData.medicineBreakdown?.length > 0 ? (
              <div className="space-y-6">
                {trackingData.medicineBreakdown.map((medicine, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div
                          className="w-6 h-6 rounded-full mr-3 shadow-sm"
                          style={{ backgroundColor: medicine.color }}
                        ></div>
                        <div>
                          <p className="font-bold text-gray-900">{medicine.name}</p>
                          <p className="text-sm text-gray-600">{medicine.doses} doses/day</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${getAdherenceColor(medicine.adherence)}`}>
                        {medicine.adherence}%
                      </span>
                    </div>
                    
                    <div className="bg-gray-200 rounded-full h-3 mb-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-1000 ${getProgressBarColor(medicine.adherence)}`}
                        style={{ width: `${medicine.adherence}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 font-medium">✓ Taken: {medicine.taken}</span>
                      <span className="text-red-600 font-medium">✗ Missed: {medicine.missed}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">📊</span>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Data Available</h3>
                <p className="text-gray-600">Add medicines to see detailed tracking data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Health Insights */}
      <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
            <span className="text-3xl mr-3">💡</span>
            Health Insights & Tips
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
              <div className="flex items-center mb-3">
                <span className="text-green-600 text-3xl mr-3">🎉</span>
                <h3 className="font-bold text-green-800">Excellent Work!</h3>
              </div>
              <p className="text-sm text-green-700">
                Your adherence rate is outstanding. Keep up the fantastic work with your medication routine!
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
              <div className="flex items-center mb-3">
                <span className="text-blue-600 text-3xl mr-3">💡</span>
                <h3 className="font-bold text-blue-800">Pro Tip</h3>
              </div>
              <p className="text-sm text-blue-700">
                Set reminder alarms 15 minutes before medication time to establish a consistent routine.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6">
              <div className="flex items-center mb-3">
                <span className="text-purple-600 text-3xl mr-3">🎯</span>
                <h3 className="font-bold text-purple-800">Health Goal</h3>
              </div>
              <p className="text-sm text-purple-700">
                Aim for 95% adherence rate for optimal health outcomes and treatment effectiveness.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthTracking;
