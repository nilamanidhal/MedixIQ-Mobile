import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LoadingSpinner from '../LoadingSpinner';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// ✅ IMPORTING FROM OFFICIAL LUCIDE-REACT
import { 
  Activity, 
  Pill, 
  CheckCircle, 
  TrendingUp, 
  BarChart3, 
  Award, 
  Lightbulb, 
  Target 
} from "lucide-react";

const HealthTracking = () => {
  const [trackingData, setTrackingData] = useState({});
  const [loading, setLoading] = useState(true);

  // ✅ Fetch tracking stats from backend
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('https://medmind-mobile.onrender.com/api/tracking/stats', {
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
    if (rate >= 90) return 'text-emerald-600 bg-emerald-100 border-emerald-200';
    if (rate >= 75) return 'text-amber-600 bg-amber-100 border-amber-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getProgressBarColor = (rate) => {
    if (rate >= 90) return 'bg-emerald-500';
    if (rate >= 75) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-full bg-slate-50 pb-24">
      
      {/* --- HEADER --- */}
      <div className="bg-green-200 px-6 pt-10 pb-6 rounded-b-[2.5rem] shadow-sm mb-8 sticky top-0 z-20 border-b border-slate-100">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-3 bg-blue-50 rounded-2xl">
            <Activity className="text-2xl text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Health Insights</h1>
        </div>
        <p className="text-slate-500 text-sm ml-14">
          Track your progress and stay consistent.
        </p>
      </div>

      <div className="px-5 max-w-7xl mx-auto space-y-8">

        {/* --- 1. OVERVIEW STATS CARDS --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Adherence Card */}
          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <Activity size={20} />
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-md ${getAdherenceColor(trackingData.adherenceRate)}`}>
                {trackingData.adherenceRate}%
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{trackingData.adherenceRate}%</p>
              <p className="text-xs text-slate-400 font-medium">Adherence Score</p>
            </div>
          </div>

          {/* Total Medicines */}
          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Pill size={20} />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{trackingData.totalMedicines}</p>
              <p className="text-xs text-slate-400 font-medium">Total Medicines</p>
            </div>
          </div>

          {/* Active Now */}
          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <CheckCircle size={20} />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{trackingData.activeMedicines}</p>
              <p className="text-xs text-slate-400 font-medium">Active Prescriptions</p>
            </div>
          </div>

          {/* Weekly Avg */}
          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <TrendingUp size={20} />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {trackingData.weeklyProgress
                  ? Math.round(trackingData.weeklyProgress.reduce((a, b) => a + b.rate, 0) / 7)
                  : 0}%
              </p>
              <p className="text-xs text-slate-400 font-medium">7-Day Average</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* --- 2. WEEKLY PROGRESS CHART (Recharts) --- */}
          <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <BarChart3 className="text-blue-500" size={20} /> Weekly Trends
                </h2>
                <p className="text-xs text-slate-400 mt-1">Adherence over last 7 days</p>
              </div>
            </div>
            
            <div className="h-64 w-full p-4">
              {trackingData.weeklyProgress ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trackingData.weeklyProgress}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                        dataKey="day" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 12, fill: '#94a3b8'}} 
                        dy={10}
                    />
                    <YAxis 
                        hide 
                        domain={[0, 100]} 
                    />
                    <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="rate" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorRate)" 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No chart data available
                </div>
              )}
            </div>
          </div>

          {/* --- 3. MEDICINE BREAKDOWN --- */}
          <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100">
            <div className="p-6 border-b border-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Pill className="text-purple-500" size={20} /> Medicine Performance
              </h2>
              <p className="text-xs text-slate-400 mt-1">Detailed breakdown by medicine</p>
            </div>
            
            <div className="p-6 space-y-5">
              {trackingData.medicineBreakdown?.length > 0 ? (
                trackingData.medicineBreakdown.map((medicine, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center gap-3">
                            <div 
                                className="w-3 h-3 rounded-full shadow-sm ring-2 ring-white"
                                style={{ backgroundColor: medicine.color || '#3b82f6' }}
                            ></div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">{medicine.name}</p>
                                <p className="text-[10px] text-slate-400">{medicine.doses} doses/day</p>
                            </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${getAdherenceColor(medicine.adherence)}`}>
                            {medicine.adherence}%
                        </span>
                    </div>
                    {/* Native-style Progress Bar */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ${getProgressBarColor(medicine.adherence)}`}
                            style={{ width: `${medicine.adherence}%` }}
                        ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <span className="text-4xl block mb-2 opacity-50">📊</span>
                  <p className="text-slate-400 text-sm">No medicine data yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- 4. INSIGHTS SECTION --- */}
        <div className="pt-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">Daily Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 relative overflow-hidden">
                    <Award className="text-4xl text-emerald-200 absolute -bottom-2 -right-2" />
                    <div className="relative z-10">
                        <h4 className="font-bold text-emerald-800 text-sm mb-1">Great Job!</h4>
                        <p className="text-xs text-emerald-600 leading-relaxed">
                            Your consistency is key to better health. Keep maintaining that streak!
                        </p>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 relative overflow-hidden">
                    <Lightbulb className="text-4xl text-blue-200 absolute -bottom-2 -right-2" />
                    <div className="relative z-10">
                        <h4 className="font-bold text-blue-800 text-sm mb-1">Did you know?</h4>
                        <p className="text-xs text-blue-600 leading-relaxed">
                            Taking meds at the same time every day improves effectiveness by 20%.
                        </p>
                    </div>
                </div>

                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 relative overflow-hidden">
                    <Target className="text-4xl text-purple-200 absolute -bottom-2 -right-2" />
                    <div className="relative z-10">
                        <h4 className="font-bold text-purple-800 text-sm mb-1">Next Goal</h4>
                        <p className="text-xs text-purple-600 leading-relaxed">
                            Try to hit a perfect 100% adherence score for 3 days in a row!
                        </p>
                    </div>
                </div>

            </div>
        </div>

      </div>
    </div>
  );
};

export default HealthTracking;








// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import LoadingSpinner from '../LoadingSpinner';

// const HealthTracking = () => {
//   const [trackingData, setTrackingData] = useState({});
//   const [loading, setLoading] = useState(true);

//   // ✅ Fetch tracking stats from backend
//   useEffect(() => {
//     const fetchStats = async () => {
//       try {
//         const token = localStorage.getItem('token');
//         const res = await axios.get('https://medmind-qnpv.onrender.com/api/tracking/stats', {
//           headers: { Authorization: `Bearer ${token}` }
//         });
//         setTrackingData(res.data);
//       } catch (error) {
//         console.error('Error fetching tracking stats:', error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchStats();
//   }, []);

//   const getAdherenceColor = (rate) => {
//     if (rate >= 90) return 'text-green-600 bg-green-100 border-green-200';
//     if (rate >= 75) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
//     return 'text-red-600 bg-red-100 border-red-200';
//   };

//   const getProgressBarColor = (rate) => {
//     if (rate >= 90) return 'bg-gradient-to-r from-green-400 to-green-600';
//     if (rate >= 75) return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
//     return 'bg-gradient-to-r from-red-400 to-red-600';
//   };

//   if (loading) return <LoadingSpinner />;

//   return (
//     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//       <div className="mb-8">
//         <h1 className="text-4xl font-bold text-gray-900 mb-3">Health Tracking 📊</h1>
//         <p className="text-xl text-gray-600">Monitor your medication progress and adherence patterns</p>
//       </div>

//       {/* Overview Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
//         <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
//           <div className="flex items-center justify-between">
//             <div>
//               <p className="text-sm text-gray-600 mb-2">Overall Adherence</p>
//               <p className={`text-3xl font-bold px-4 py-2 rounded-xl border ${getAdherenceColor(trackingData.adherenceRate)}`}>
//                 {trackingData.adherenceRate}%
//               </p>
//             </div>
//             <div className="text-5xl">📈</div>
//           </div>
//         </div>

//         <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
//           <div className="flex items-center justify-between">
//             <div>
//               <p className="text-sm text-gray-600 mb-2">Total Medicines</p>
//               <p className="text-3xl font-bold text-blue-600">{trackingData.totalMedicines}</p>
//             </div>
//             <div className="text-5xl">💊</div>
//           </div>
//         </div>

//         <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
//           <div className="flex items-center justify-between">
//             <div>
//               <p className="text-sm text-gray-600 mb-2">Active Now</p>
//               <p className="text-3xl font-bold text-green-600">{trackingData.activeMedicines}</p>
//             </div>
//             <div className="text-5xl">✅</div>
//           </div>
//         </div>

//         <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
//           <div className="flex items-center justify-between">
//             <div>
//               <p className="text-sm text-gray-600 mb-2">Weekly Average</p>
//               <p className="text-3xl font-bold text-purple-600">
//                 {trackingData.weeklyProgress
//                   ? Math.round(trackingData.weeklyProgress.reduce((a, b) => a + b.rate, 0) / 7)
//                   : 0}%
//               </p>
//             </div>
//             <div className="text-5xl">📊</div>
//           </div>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
//         {/* Weekly Progress Chart */}
//         <div className="bg-white rounded-xl shadow-lg border border-gray-200">
//           <div className="p-6 border-b border-gray-200">
//             <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
//               <span className="text-3xl mr-3">📈</span>
//               Weekly Progress Chart
//             </h2>
//             <p className="text-sm text-gray-600 mt-1">Your adherence rate over the last 7 days</p>
//           </div>
//           <div className="p-6">
//             {trackingData.weeklyProgress && (
//               <div className="space-y-6">
//                 {trackingData.weeklyProgress.map((day, index) => (
//                   <div key={index} className="space-y-2">
//                     <div className="flex justify-between items-center">
//                       <div className="flex items-center">
//                         <span className="text-sm font-bold text-gray-700 w-12">{day.day}</span>
//                         <span className="text-xs text-gray-500 ml-2">{day.doses} doses</span>
//                       </div>
//                       <div className="flex items-center">
//                         <span className="text-sm font-bold text-gray-900 mr-3">{day.rate}%</span>
//                         <span className={`px-2 py-1 rounded text-xs font-medium ${getAdherenceColor(day.rate)}`}>
//                           {day.rate >= 90 ? 'Excellent' : day.rate >= 75 ? 'Good' : 'Needs Work'}
//                         </span>
//                       </div>
//                     </div>
//                     <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
//                       <div
//                         className={`h-4 rounded-full transition-all duration-1000 ease-out ${getProgressBarColor(day.rate)}`}
//                         style={{ width: `${day.rate}%` }}
//                       ></div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Medicine Breakdown */}
//         <div className="bg-white rounded-xl shadow-lg border border-gray-200">
//           <div className="p-6 border-b border-gray-200">
//             <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
//               <span className="text-3xl mr-3">💊</span>
//               Medicine Performance
//             </h2>
//             <p className="text-sm text-gray-600 mt-1">Individual adherence rates for each medicine</p>
//           </div>
//           <div className="p-6">
//             {trackingData.medicineBreakdown?.length > 0 ? (
//               <div className="space-y-6">
//                 {trackingData.medicineBreakdown.map((medicine, index) => (
//                   <div key={index} className="p-4 bg-gray-50 rounded-xl">
//                     <div className="flex items-center justify-between mb-3">
//                       <div className="flex items-center">
//                         <div
//                           className="w-6 h-6 rounded-full mr-3 shadow-sm"
//                           style={{ backgroundColor: medicine.color }}
//                         ></div>
//                         <div>
//                           <p className="font-bold text-gray-900">{medicine.name}</p>
//                           <p className="text-sm text-gray-600">{medicine.doses} doses/day</p>
//                         </div>
//                       </div>
//                       <span className={`px-3 py-1 rounded-full text-sm font-bold ${getAdherenceColor(medicine.adherence)}`}>
//                         {medicine.adherence}%
//                       </span>
//                     </div>
                    
//                     <div className="bg-gray-200 rounded-full h-3 mb-3">
//                       <div
//                         className={`h-3 rounded-full transition-all duration-1000 ${getProgressBarColor(medicine.adherence)}`}
//                         style={{ width: `${medicine.adherence}%` }}
//                       ></div>
//                     </div>
                    
//                     <div className="flex justify-between text-sm">
//                       <span className="text-green-600 font-medium">✓ Taken: {medicine.taken}</span>
//                       <span className="text-red-600 font-medium">✗ Missed: {medicine.missed}</span>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               <div className="text-center py-12">
//                 <span className="text-6xl mb-4 block">📊</span>
//                 <h3 className="text-xl font-bold text-gray-900 mb-2">No Data Available</h3>
//                 <p className="text-gray-600">Add medicines to see detailed tracking data</p>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Health Insights */}
//       <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-200">
//         <div className="p-6 border-b border-gray-200">
//           <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
//             <span className="text-3xl mr-3">💡</span>
//             Health Insights & Tips
//           </h2>
//         </div>
//         <div className="p-6">
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//             <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
//               <div className="flex items-center mb-3">
//                 <span className="text-green-600 text-3xl mr-3">🎉</span>
//                 <h3 className="font-bold text-green-800">Excellent Work!</h3>
//               </div>
//               <p className="text-sm text-green-700">
//                 Your adherence rate is outstanding. Keep up the fantastic work with your medication routine!
//               </p>
//             </div>
            
//             <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
//               <div className="flex items-center mb-3">
//                 <span className="text-blue-600 text-3xl mr-3">💡</span>
//                 <h3 className="font-bold text-blue-800">Pro Tip</h3>
//               </div>
//               <p className="text-sm text-blue-700">
//                 Set reminder alarms 15 minutes before medication time to establish a consistent routine.
//               </p>
//             </div>
            
//             <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6">
//               <div className="flex items-center mb-3">
//                 <span className="text-purple-600 text-3xl mr-3">🎯</span>
//                 <h3 className="font-bold text-purple-800">Health Goal</h3>
//               </div>
//               <p className="text-sm text-purple-700">
//                 Aim for 95% adherence rate for optimal health outcomes and treatment effectiveness.
//               </p>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default HealthTracking;
