import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LoadingSpinner from '../LoadingSpinner';
import { useHealthData } from '../../hooks/useHealthData';
import { useMedicines } from '../../hooks/useMedicines';
import { useAuth } from '../../contexts/AuthContext'; // Need this for direct axios calls
import PredictiveHealthCard from '../PredictiveHealthCard';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Activity, Pill, CheckCircle, TrendingUp, BarChart3, Award, Grid, CalendarDays, X, Clock, Flame 
} from "lucide-react";

// --- HISTORY MODAL (Shows All Meds) ---
const MedicineHistoryModal = ({ isOpen, onClose }) => {
    const { token, API_BASE_URL } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            const fetchHistory = async () => {
                try {
                    const res = await axios.get(`${API_BASE_URL}/medicines/history-all`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setHistory(res.data.medicines);
                } catch (e) { console.error(e); } 
                finally { setLoading(false); }
            };
            fetchHistory();
        }
    }, [isOpen, token]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Medicine History</h2>
                        <p className="text-xs text-slate-400">All medicines ever added</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>
                
                <div className="overflow-y-auto p-4 pb-24 space-y-3 bg-slate-50 flex-1">
                    {loading ? <LoadingSpinner text="Loading history..." /> : (
                        history.map(med => (
                            <div key={med._id} className={`p-4 rounded-2xl border ${med.isActive ? 'bg-white border-slate-100' : 'bg-slate-100 border-transparent opacity-75'} shadow-sm`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className={`font-bold ${med.isActive ? 'text-slate-800' : 'text-slate-500 line-through'}`}>
                                            {med.name}
                                        </h3>
                                        <p className="text-xs text-slate-400 font-medium">{med.dose}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${med.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                                        {med.isActive ? 'ACTIVE' : 'STOPPED'}
                                    </span>
                                </div>
                                <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400 font-medium border-t border-slate-50 pt-2">
                                    <span className="flex items-center gap-1"><CalendarDays size={12}/> Added: {new Date(med.createdAt).toLocaleDateString()}</span>
                                    {!med.isActive && <span>Stopped: {new Date(med.updatedAt).toLocaleDateString()}</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// --- IMPROVED HEATMAP ---
const HeatmapView = ({ data }) => {
    const days = data || []; 
    
    const getColor = (rate) => {
        if (rate === -1) return 'bg-slate-100 border-slate-200'; // No meds scheduled
        if (rate === 100) return 'bg-emerald-500 shadow-emerald-200';
        if (rate >= 75) return 'bg-emerald-300';
        if (rate >= 50) return 'bg-yellow-300';
        return 'bg-red-300'; 
    };

    return (
        <div className="w-full p-4 flex flex-col justify-center items-center">
            {/* Grid Calculation: Auto-fill width */}
            <div className="flex flex-wrap gap-1.5 justify-center max-w-[320px]">
                {days.map((day, i) => (
                    <div key={i} className="group relative">
                        <div 
                            className={`w-7 h-7 rounded-md ${getColor(day.rate)} transition-all hover:scale-110 cursor-pointer border border-transparent`} 
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block w-max bg-slate-800 text-white text-[10px] px-2 py-1 rounded-md z-10">
                            {day.day}: {day.rate === -1 ? 'Rest Day' : `${day.rate}%`}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="flex justify-center gap-4 mt-4 text-[10px] text-slate-400 font-medium">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-slate-200"/> No Meds</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-red-300"/> Missed</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-emerald-500"/> Perfect</div>
            </div>
        </div>
    );
};

// --- MAIN PAGE ---
const HealthTracking = () => {
  const [range, setRange] = useState(7); // 🟢 7 or 30 days
  const { stats: trackingData, loading } = useHealthData(range);
  const { medicines } = useMedicines();
  
  const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'heatmap'
  const [showHistory, setShowHistory] = useState(false); // Modal State

  // 🟢 CALCULATE STREAK
  // Count consecutive days (working backwards) where rate is 100% or -1 (Rest Day)
  const calculateStreak = (progress = []) => {
      let streak = 0;
      for (let i = progress.length - 1; i >= 0; i--) {
          const r = progress[i].rate;
          if (r === 100 || r === -1) streak++;
          else break;
      }
      return streak;
  };

  const currentStreak = calculateStreak(trackingData?.weeklyProgress || []);

  // --- HELPERS ---
  const getAdherenceColor = (rate) => {
    if (rate >= 90) return 'text-emerald-600 bg-emerald-50';
    if (rate >= 75) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getStrokeColor = (rate) => {
    if (rate >= 90) return '#10b981'; 
    if (rate >= 75) return '#f59e0b'; 
    return '#ef4444'; 
  };

  const CircleProgressBox = ({ percentage, color, label, subLabel }) => {
    const radius = 24; 
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="flex flex-col items-center justify-center py-2">
        <div className="relative w-20 h-20 flex items-center justify-center mb-3">
          <svg className="transform -rotate-90 w-full h-full drop-shadow-sm">
            <circle cx="40" cy="40" r={radius} stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
            <circle
              cx="40" cy="40" r={radius} stroke={color} strokeWidth="6"
              fill="transparent" strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset} strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-sm font-bold text-slate-700">{percentage}%</span>
          </div>
        </div>
        <h4 className="text-sm font-bold text-slate-800 text-center leading-tight px-1 truncate w-full">
            {label}
        </h4>
        <p className="text-[10px] text-slate-400 font-medium text-center mt-0.5">
            {subLabel}
        </p>
      </div>
    );
  };

  if (loading && !trackingData) return <LoadingSpinner />;

  const data = trackingData || { 
      adherenceRate: 0, 
      totalMedicines: 0, 
      activeMedicines: 0, 
      weeklyProgress: [], 
      medicineBreakdown: [] 
  };

  return (
    <div className="min-h-full bg-slate-50 pb-24">
      <MedicineHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} />

      {/* HEADER */}
      <div className="bg-green-200 px-6 pt-10 pb-6 rounded-b-[2.5rem] shadow-sm mb-6 sticky top-0 z-20 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-50 rounded-2xl">
                    <Activity className="text-2xl text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Health Insights</h1>
            </div>
            
            {/* 🟢 DATE RANGE TOGGLE */}
            <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-xl">
                <button 
                    onClick={() => setRange(7)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${range === 7 ? 'bg-white shadow-sm text-green-700' : 'text-slate-500'}`}
                >7 Days</button>
                <button 
                    onClick={() => setRange(30)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${range === 30 ? 'bg-white shadow-sm text-green-700' : 'text-slate-500'}`}
                >30 Days</button>
            </div>
        </div>
        <p className="text-slate-500 text-sm ml-14">Your {range}-day health overview.</p>
      </div>

      <div className="px-5 max-w-7xl mx-auto space-y-6">

        {/* 🧠 AI CARD */}
        {data.medicineBreakdown?.length > 0 && <PredictiveHealthCard medicines={medicines} stats={data} />}

        {/* STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Adherence */}
          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <Activity size={20} />
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-md ${getAdherenceColor(data.adherenceRate)}`}>
                {data.adherenceRate}%
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{data.adherenceRate}%</p>
              <p className="text-xs text-slate-400 font-medium">Adherence Score</p>
            </div>
          </div>

          {/* 🟢 Total Medicines (CLICKABLE HISTORY) */}
          <div 
            onClick={() => setShowHistory(true)}
            className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32 cursor-pointer hover:bg-slate-50 transition-colors group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
                <Pill size={20} />
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-bold group-hover:bg-white">View All</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{data.totalMedicines}</p>
              <p className="text-xs text-slate-400 font-medium">Lifetime Medicines</p>
            </div>
          </div>
          
          {/* Active */}
          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <CheckCircle size={20} />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{data.activeMedicines}</p>
              <p className="text-xs text-slate-400 font-medium">Active Now</p>
            </div>
          </div>

          {/* 🟢 STREAK (Replaces Average) */}
          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                <Flame size={20} fill="currentColor" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {currentStreak} <span className="text-sm text-slate-400 font-normal">Days</span>
              </p>
              <p className="text-xs text-slate-400 font-medium">Current Streak</p>
            </div>
          </div>
        </div>

        {/* --- TREND CHART/HEATMAP --- */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                {viewMode === 'chart' ? <BarChart3 className="text-blue-500" size={16} /> : <Grid className="text-blue-500" size={16} />} 
                {viewMode === 'chart' ? 'Activity Trend' : 'Consistency Heatmap'}
              </h2>
              
              <div className="flex bg-slate-50 rounded-lg p-1 border border-slate-100">
                  <button onClick={() => setViewMode('chart')} className={`p-1.5 rounded-md transition-all ${viewMode === 'chart' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>
                      <BarChart3 size={14} />
                  </button>
                  <button onClick={() => setViewMode('heatmap')} className={`p-1.5 rounded-md transition-all ${viewMode === 'heatmap' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>
                      <Grid size={14} />
                  </button>
              </div>
            </div>

            {viewMode === 'chart' ? (
                <div className="h-44 w-full p-2 animate-in fade-in">
                  {data.weeklyProgress?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.weeklyProgress}>
                        <defs>
                          <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={5} interval={range === 30 ? 4 : 0} />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} cursor={false} />
                        {/* Only connect points if they are not -1 (No Meds) */}
                        <Area 
                            type="monotone" 
                            dataKey="rate" 
                            stroke="#3b82f6" 
                            strokeWidth={2} 
                            fillOpacity={1} 
                            fill="url(#colorRate)" 
                            connectNulls={false} // Don't draw lines through rest days if you send null
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">No Data</div>
                  )}
                </div>
            ) : (
                <div className="animate-in fade-in pb-4">
                    <HeatmapView data={data.weeklyProgress} />
                </div>
            )}
        </div>

        {/* MEDICINE PERFORMANCE */}
        <div>
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Medicine Performance</h3>
           <div className="grid grid-cols-2 gap-3">
              {data.medicineBreakdown?.length > 0 ? (
                [...data.medicineBreakdown].reverse().map((medicine, index) => (
                  <div key={index} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                      <CircleProgressBox 
                        percentage={medicine.adherence}
                        color={getStrokeColor(medicine.adherence)}
                        label={medicine.name}
                        subLabel={`${medicine.doses} doses/day`}
                      />
                  </div>
                ))
              ) : (
                <div className="col-span-2 bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center">
                  <p className="text-slate-400 text-sm">No medicines found</p>
                </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
};

export default HealthTracking;












// import React, { useState } from 'react';
// import LoadingSpinner from '../LoadingSpinner';
// import { useHealthData } from '../../hooks/useHealthData';
// import { useMedicines } from '../../hooks/useMedicines';
// import PredictiveHealthCard from '../PredictiveHealthCard';
// import { 
//   AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
// } from 'recharts';
// import { 
//   Activity, Pill, CheckCircle, TrendingUp, BarChart3, Award, Calendar, Grid 
// } from "lucide-react";

// // --- CUSTOM HEATMAP COMPONENT ---
// const HeatmapView = ({ data }) => {
//     // Generate dummy "last 14 days" if data is sparse, or map your real daily data here
//     // Currently mapping from weeklyProgress to simulate a grid view
//     const days = data || []; 
    
//     const getColor = (rate) => {
//         if (rate === 100) return 'bg-emerald-500';
//         if (rate >= 75) return 'bg-emerald-300';
//         if (rate >= 50) return 'bg-yellow-300';
//         if (rate > 0) return 'bg-red-300';
//         return 'bg-slate-100'; // 0 or missed
//     };

//     return (
//         <div className="h-40 w-full p-4 flex flex-col justify-center">
//             <div className="flex flex-wrap gap-2 justify-center">
//                 {days.map((day, i) => (
//                     <div key={i} className="flex flex-col items-center gap-1">
//                         {/* The Square */}
//                         <div 
//                             className={`w-8 h-8 rounded-lg ${getColor(day.rate)} transition-all hover:scale-110 shadow-sm`} 
//                             title={`${day.day}: ${day.rate}%`}
//                         />
//                         {/* The Label */}
//                         <span className="text-[10px] text-slate-400 font-bold">{day.day.substring(0,1)}</span>
//                     </div>
//                 ))}
//                 {days.length === 0 && <span className="text-slate-400 text-xs">No activity data yet</span>}
//             </div>
            
//             {/* Legend */}
//             <div className="flex justify-center gap-3 mt-4">
//                 <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-emerald-500"/> <span className="text-[10px] text-slate-400">Perfect</span></div>
//                 <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-yellow-300"/> <span className="text-[10px] text-slate-400">Okay</span></div>
//                 <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-red-300"/> <span className="text-[10px] text-slate-400">Missed</span></div>
//             </div>
//         </div>
//     );
// };

// // --- MAIN PAGE ---
// const HealthTracking = () => {
//   const { stats: trackingData, loading } = useHealthData();
//   const { medicines } = useMedicines();
  
//   // 🟢 TOGGLE STATE
//   const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'heatmap'

//   const getAdherenceColor = (rate) => {
//     if (rate >= 90) return 'text-emerald-600 bg-emerald-50';
//     if (rate >= 75) return 'text-amber-600 bg-amber-50';
//     return 'text-red-600 bg-red-50';
//   };

//   const getStrokeColor = (rate) => {
//     if (rate >= 90) return '#10b981'; 
//     if (rate >= 75) return '#f59e0b'; 
//     return '#ef4444'; 
//   };

//   const CircleProgressBox = ({ percentage, color, label, subLabel }) => {
//     const radius = 24; 
//     const circumference = 2 * Math.PI * radius;
//     const strokeDashoffset = circumference - (percentage / 100) * circumference;

//     return (
//       <div className="flex flex-col items-center justify-center py-2">
//         <div className="relative w-20 h-20 flex items-center justify-center mb-3">
//           <svg className="transform -rotate-90 w-full h-full drop-shadow-sm">
//             <circle cx="40" cy="40" r={radius} stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
//             <circle
//               cx="40" cy="40" r={radius} stroke={color} strokeWidth="6"
//               fill="transparent" strokeDasharray={circumference}
//               strokeDashoffset={strokeDashoffset} strokeLinecap="round"
//               className="transition-all duration-1000 ease-out"
//             />
//           </svg>
//           <div className="absolute inset-0 flex items-center justify-center">
//              <span className="text-sm font-bold text-slate-700">{percentage}%</span>
//           </div>
//         </div>
//         <h4 className="text-sm font-bold text-slate-800 text-center leading-tight px-1 truncate w-full">
//             {label}
//         </h4>
//         <p className="text-[10px] text-slate-400 font-medium text-center mt-0.5">
//             {subLabel}
//         </p>
//       </div>
//     );
//   };

//   if (loading && !trackingData) return <LoadingSpinner />;

//   const data = trackingData || { 
//       adherenceRate: 0, 
//       totalMedicines: 0, 
//       activeMedicines: 0, 
//       weeklyProgress: [], 
//       medicineBreakdown: [] 
//   };

//   return (
//     <div className="min-h-full bg-slate-50 pb-24">
      
//       {/* HEADER */}
//       <div className="bg-green-200 px-6 pt-10 pb-6 rounded-b-[2.5rem] shadow-sm mb-6 sticky top-0 z-20 border-b border-slate-100">
//         <div className="flex items-center space-x-3 mb-2">
//           <div className="p-3 bg-blue-50 rounded-2xl">
//             <Activity className="text-2xl text-blue-600" />
//           </div>
//           <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Health Insights</h1>
//         </div>
//         <p className="text-slate-500 text-sm ml-14">Your daily health overview.</p>
//       </div>

//       <div className="px-5 max-w-7xl mx-auto space-y-6">

//         {/* 🧠 PREDICTIVE AI CARD (Now with Input) */}
//         <PredictiveHealthCard medicines={medicines} stats={data} />

//         {/* STATS CARDS (Adherence, Total, Active, Avg) */}
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
//                 <Activity size={20} />
//               </div>
//               <span className={`text-xs font-bold px-2 py-1 rounded-md ${getAdherenceColor(data.adherenceRate)}`}>
//                 {data.adherenceRate}%
//               </span>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">{data.adherenceRate}%</p>
//               <p className="text-xs text-slate-400 font-medium">Adherence Score</p>
//             </div>
//           </div>
//           {/* ... (Other stat cards remain same) ... */}
//           {/* Total Medicines */}
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
//                 <Pill size={20} />
//               </div>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">{data.totalMedicines}</p>
//               <p className="text-xs text-slate-400 font-medium">Total Medicines</p>
//             </div>
//           </div>
          
//           {/* Active Now */}
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
//                 <CheckCircle size={20} />
//               </div>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">{data.activeMedicines}</p>
//               <p className="text-xs text-slate-400 font-medium">Active Prescriptions</p>
//             </div>
//           </div>

//           {/* Weekly Avg */}
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
//                 <TrendingUp size={20} />
//               </div>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">
//                 {data.weeklyProgress?.length > 0
//                   ? Math.round(data.weeklyProgress.reduce((a, b) => a + b.rate, 0) / 7)
//                   : 0}%
//               </p>
//               <p className="text-xs text-slate-400 font-medium">7-Day Average</p>
//             </div>
//           </div>
//         </div>

//         {/* --- 📊 TREND SECTION (WITH TOGGLE) --- */}
//         <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
//             {/* Header with Toggle */}
//             <div className="p-4 border-b border-slate-50 flex justify-between items-center">
//               <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
//                 {viewMode === 'chart' ? <BarChart3 className="text-blue-500" size={16} /> : <Grid className="text-blue-500" size={16} />} 
//                 {viewMode === 'chart' ? 'Weekly Trend' : 'Activity Heatmap'}
//               </h2>
              
//               {/* Toggle Buttons */}
//               <div className="flex bg-slate-50 rounded-lg p-1 border border-slate-100">
//                   <button 
//                     onClick={() => setViewMode('chart')}
//                     className={`p-1.5 rounded-md transition-all ${viewMode === 'chart' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
//                   >
//                       <BarChart3 size={14} />
//                   </button>
//                   <button 
//                     onClick={() => setViewMode('heatmap')}
//                     className={`p-1.5 rounded-md transition-all ${viewMode === 'heatmap' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
//                   >
//                       <Grid size={14} />
//                   </button>
//               </div>
//             </div>

//             {/* Content Area */}
//             {viewMode === 'chart' ? (
//                 <div className="h-40 w-full p-2 animate-in fade-in">
//                   {data.weeklyProgress?.length > 0 ? (
//                     <ResponsiveContainer width="100%" height="100%">
//                       <AreaChart data={data.weeklyProgress}>
//                         <defs>
//                           <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
//                             <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
//                             <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
//                           </linearGradient>
//                         </defs>
//                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
//                         <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={5} />
//                         <YAxis hide domain={[0, 100]} />
//                         <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} cursor={false} />
//                         <Area type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" />
//                       </AreaChart>
//                     </ResponsiveContainer>
//                   ) : (
//                     <div className="h-full flex items-center justify-center text-slate-400 text-xs">No Data</div>
//                   )}
//                 </div>
//             ) : (
//                 <div className="animate-in fade-in">
//                     <HeatmapView data={data.weeklyProgress} />
//                 </div>
//             )}
//         </div>

//         {/* MEDICINE PERFORMANCE */}
//         <div>
//            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Medicine Performance</h3>
//            <div className="grid grid-cols-2 gap-3">
//               {data.medicineBreakdown?.length > 0 ? (
//                 [...data.medicineBreakdown].reverse().map((medicine, index) => (
//                   <div key={index} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
//                       <CircleProgressBox 
//                         percentage={medicine.adherence}
//                         color={getStrokeColor(medicine.adherence)}
//                         label={medicine.name}
//                         subLabel={`${medicine.doses} doses/day`}
//                       />
//                   </div>
//                 ))
//               ) : (
//                 <div className="col-span-2 bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center">
//                   <p className="text-slate-400 text-sm">No medicines found</p>
//                 </div>
//               )}
//            </div>
//         </div>

//         {/* INSIGHTS */}
//         <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex gap-4">
//             <div className="bg-white p-2 rounded-full shadow-sm text-emerald-500 h-fit">
//                 <Award size={18} />
//             </div>
//             <div>
//                 <h4 className="font-bold text-emerald-900 text-sm">Keep it up!</h4>
//                 <p className="text-xs text-emerald-700 mt-1">
//                     Consistent timing improves effectiveness by 20%.
//                 </p>
//             </div>
//         </div>

//       </div>
//     </div>
//   );
// };

// export default HealthTracking;













// import React from 'react';
// import LoadingSpinner from '../LoadingSpinner';
// import { useHealthData } from '../../hooks/useHealthData'; // 👈 Optimized Hook
// import { useMedicines } from '../../hooks/useMedicines';   // 👈 For medicine conditions
// import PredictiveHealthCard from '../PredictiveHealthCard'; // 👈 AI Component
// import { 
//   AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
// } from 'recharts';
// import { 
//   Activity, Pill, CheckCircle, TrendingUp, BarChart3, Award 
// } from "lucide-react";

// const HealthTracking = () => {
//   // 1. Use Optimized Hook (Instant Load)
//   const { stats: trackingData, loading } = useHealthData();
  
//   // 2. Get Medicine List (For AI context: "What is this medicine for?")
//   const { medicines } = useMedicines();

//   const getAdherenceColor = (rate) => {
//     if (rate >= 90) return 'text-emerald-600 bg-emerald-50';
//     if (rate >= 75) return 'text-amber-600 bg-amber-50';
//     return 'text-red-600 bg-red-50';
//   };

//   const getStrokeColor = (rate) => {
//     if (rate >= 90) return '#10b981'; 
//     if (rate >= 75) return '#f59e0b'; 
//     return '#ef4444'; 
//   };

//   const CircleProgressBox = ({ percentage, color, label, subLabel }) => {
//     const radius = 24;
//     const circumference = 2 * Math.PI * radius;
//     const strokeDashoffset = circumference - (percentage / 100) * circumference;

//     return (
//       <div className="flex flex-col items-center justify-center py-2">
//         <div className="relative w-20 h-20 flex items-center justify-center mb-3">
//           <svg className="transform -rotate-90 w-full h-full drop-shadow-sm">
//             <circle cx="40" cy="40" r={radius} stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
//             <circle
//               cx="40" cy="40" r={radius} stroke={color} strokeWidth="6"
//               fill="transparent" strokeDasharray={circumference}
//               strokeDashoffset={strokeDashoffset} strokeLinecap="round"
//               className="transition-all duration-1000 ease-out"
//             />
//           </svg>
//           <div className="absolute inset-0 flex items-center justify-center">
//              <span className="text-sm font-bold text-slate-700">{percentage}%</span>
//           </div>
//         </div>
//         <h4 className="text-sm font-bold text-slate-800 text-center leading-tight px-1 truncate w-full">
//             {label}
//         </h4>
//         <p className="text-[10px] text-slate-400 font-medium text-center mt-0.5">
//             {subLabel}
//         </p>
//       </div>
//     );
//   };

//   // 3. Loading State (Only for first install / empty cache)
//   if (loading && !trackingData) return <LoadingSpinner />;

//   // 4. Safe Default Data (Prevent crashes if API fails)
//   const data = trackingData || { 
//       adherenceRate: 0, 
//       totalMedicines: 0, 
//       activeMedicines: 0, 
//       weeklyProgress: [], 
//       medicineBreakdown: [] 
//   };

//   return (
//     <div className="min-h-full bg-slate-50 pb-24">
      
//       {/* --- HEADER --- */}
//       <div className="bg-green-200 px-6 pt-10 pb-6 rounded-b-[2.5rem] shadow-sm mb-6 sticky top-0 z-20 border-b border-slate-100">
//         <div className="flex items-center space-x-3 mb-2">
//           <div className="p-3 bg-blue-50 rounded-2xl">
//             <Activity className="text-2xl text-blue-600" />
//           </div>
//           <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Health Insights</h1>
//         </div>
//         <p className="text-slate-500 text-sm ml-14">Your daily health overview.</p>
//       </div>

//       <div className="px-5 max-w-7xl mx-auto space-y-6">

//         {/* 🔥 NEW: PREDICTIVE AI CARD (ON DEMAND) */}
//         {/* Only show if we have data to analyze */}
//         {data.medicineBreakdown?.length > 0 && (
//             <PredictiveHealthCard 
//                 medicines={medicines} 
//                 stats={data} 
//             />
//         )}

//         {/* --- 1. OVERVIEW STATS CARDS --- */}
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//           {/* Adherence Card */}
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
//                 <Activity size={20} />
//               </div>
//               <span className={`text-xs font-bold px-2 py-1 rounded-md ${getAdherenceColor(data.adherenceRate)}`}>
//                 {data.adherenceRate}%
//               </span>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">{data.adherenceRate}%</p>
//               <p className="text-xs text-slate-400 font-medium">Adherence Score</p>
//             </div>
//           </div>

//           {/* Total Medicines */}
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
//                 <Pill size={20} />
//               </div>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">{data.totalMedicines}</p>
//               <p className="text-xs text-slate-400 font-medium">Total Medicines</p>
//             </div>
//           </div>

//           {/* Active Now */}
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
//                 <CheckCircle size={20} />
//               </div>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">{data.activeMedicines}</p>
//               <p className="text-xs text-slate-400 font-medium">Active Prescriptions</p>
//             </div>
//           </div>

//           {/* Weekly Avg */}
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
//                 <TrendingUp size={20} />
//               </div>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">
//                 {data.weeklyProgress?.length > 0
//                   ? Math.round(data.weeklyProgress.reduce((a, b) => a + b.rate, 0) / 7)
//                   : 0}%
//               </p>
//               <p className="text-xs text-slate-400 font-medium">7-Day Average</p>
//             </div>
//           </div>
//         </div>

//         {/* --- 2. WEEKLY CHART --- */}
//         <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
//             <div className="p-4 border-b border-slate-50">
//               <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
//                 <BarChart3 className="text-blue-500" size={16} /> Weekly Trend
//               </h2>
//             </div>
//             <div className="h-40 w-full p-2">
//               {data.weeklyProgress?.length > 0 ? (
//                 <ResponsiveContainer width="100%" height="100%">
//                   <AreaChart data={data.weeklyProgress}>
//                     <defs>
//                       <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
//                         <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
//                         <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
//                       </linearGradient>
//                     </defs>
//                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
//                     <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={5} />
//                     <YAxis hide domain={[0, 100]} />
//                     <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} cursor={false} />
//                     <Area type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" />
//                   </AreaChart>
//                 </ResponsiveContainer>
//               ) : (
//                 <div className="h-full flex items-center justify-center text-slate-400 text-xs">No Data</div>
//               )}
//             </div>
//         </div>

//         {/* --- 3. MEDICINE PERFORMANCE --- */}
//         <div>
//            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Medicine Performance</h3>
//            <div className="grid grid-cols-2 gap-3">
//               {data.medicineBreakdown?.length > 0 ? (
//                 [...data.medicineBreakdown].reverse().map((medicine, index) => (
//                   <div key={index} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
//                       <CircleProgressBox 
//                         percentage={medicine.adherence}
//                         color={getStrokeColor(medicine.adherence)}
//                         label={medicine.name}
//                         subLabel={`${medicine.doses} doses/day`}
//                       />
//                   </div>
//                 ))
//               ) : (
//                 <div className="col-span-2 bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center">
//                   <p className="text-slate-400 text-sm">No medicines found</p>
//                 </div>
//               )}
//            </div>
//         </div>

//         {/* --- 4. INSIGHTS --- */}
//         <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex gap-4">
//             <div className="bg-white p-2 rounded-full shadow-sm text-emerald-500 h-fit">
//                 <Award size={18} />
//             </div>
//             <div>
//                 <h4 className="font-bold text-emerald-900 text-sm">Keep it up!</h4>
//                 <p className="text-xs text-emerald-700 mt-1">
//                     Consistent timing improves effectiveness by 20%.
//                 </p>
//             </div>
//         </div>

//       </div>
//     </div>
//   );
// };

// export default HealthTracking;









// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import LoadingSpinner from '../LoadingSpinner';
// import { 
//   AreaChart, 
//   Area, 
//   XAxis, 
//   YAxis, 
//   CartesianGrid, 
//   Tooltip, 
//   ResponsiveContainer 
// } from 'recharts';

// // ✅ IMPORTING FROM OFFICIAL LUCIDE-REACT
// import { 
//   Activity, 
//   Pill, 
//   CheckCircle, 
//   TrendingUp, 
//   BarChart3, 
//   Award, 
//   Lightbulb, 
//   Target 
// } from "lucide-react";

// const HealthTracking = () => {
//   const [trackingData, setTrackingData] = useState({});
//   const [loading, setLoading] = useState(true);

//   // ✅ Fetch tracking stats from backend
//   useEffect(() => {
//     const fetchStats = async () => {
//       try {
//         const token = localStorage.getItem('token');
//         const res = await axios.get('https://medmind-mobile.onrender.com/api/tracking/stats', {
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
//     if (rate >= 90) return 'text-emerald-600 bg-emerald-100 border-emerald-200';
//     if (rate >= 75) return 'text-amber-600 bg-amber-100 border-amber-200';
//     return 'text-red-600 bg-red-100 border-red-200';
//   };

//   const getProgressBarColor = (rate) => {
//     if (rate >= 90) return 'bg-emerald-500';
//     if (rate >= 75) return 'bg-amber-500';
//     return 'bg-red-500';
//   };

//   if (loading) return <LoadingSpinner />;

//   return (
//     <div className="min-h-full bg-slate-50 pb-24">
      
//       {/* --- HEADER --- */}
//       <div className="bg-green-200 px-6 pt-10 pb-6 rounded-b-[2.5rem] shadow-sm mb-8 sticky top-0 z-20 border-b border-slate-100">
//         <div className="flex items-center space-x-3 mb-2">
//           <div className="p-3 bg-blue-50 rounded-2xl">
//             <Activity className="text-2xl text-blue-600" />
//           </div>
//           <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Health Insights</h1>
//         </div>
//         <p className="text-slate-500 text-sm ml-14">
//           Track your progress and stay consistent.
//         </p>
//       </div>

//       <div className="px-5 max-w-7xl mx-auto space-y-8">

//         {/* --- 1. OVERVIEW STATS CARDS --- */}
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//           {/* Adherence Card */}
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
//                 <Activity size={20} />
//               </div>
//               <span className={`text-xs font-bold px-2 py-1 rounded-md ${getAdherenceColor(trackingData.adherenceRate)}`}>
//                 {trackingData.adherenceRate}%
//               </span>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">{trackingData.adherenceRate}%</p>
//               <p className="text-xs text-slate-400 font-medium">Adherence Score</p>
//             </div>
//           </div>

//           {/* Total Medicines */}
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
//                 <Pill size={20} />
//               </div>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">{trackingData.totalMedicines}</p>
//               <p className="text-xs text-slate-400 font-medium">Total Medicines</p>
//             </div>
//           </div>

//           {/* Active Now */}
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
//                 <CheckCircle size={20} />
//               </div>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">{trackingData.activeMedicines}</p>
//               <p className="text-xs text-slate-400 font-medium">Active Prescriptions</p>
//             </div>
//           </div>

//           {/* Weekly Avg */}
//           <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between h-32">
//             <div className="flex justify-between items-start">
//               <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
//                 <TrendingUp size={20} />
//               </div>
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-slate-800">
//                 {trackingData.weeklyProgress
//                   ? Math.round(trackingData.weeklyProgress.reduce((a, b) => a + b.rate, 0) / 7)
//                   : 0}%
//               </p>
//               <p className="text-xs text-slate-400 font-medium">7-Day Average</p>
//             </div>
//           </div>
//         </div>

//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
//           {/* --- 2. WEEKLY PROGRESS CHART (Recharts) --- */}
//           <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden">
//             <div className="p-6 border-b border-slate-50 flex items-center justify-between">
//               <div>
//                 <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
//                   <BarChart3 className="text-blue-500" size={20} /> Weekly Trends
//                 </h2>
//                 <p className="text-xs text-slate-400 mt-1">Adherence over last 7 days</p>
//               </div>
//             </div>
            
//             <div className="h-64 w-full p-4">
//               {trackingData.weeklyProgress ? (
//                 <ResponsiveContainer width="100%" height="100%">
//                   <AreaChart data={trackingData.weeklyProgress}>
//                     <defs>
//                       <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
//                         <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
//                         <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
//                       </linearGradient>
//                     </defs>
//                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
//                     <XAxis 
//                         dataKey="day" 
//                         axisLine={false} 
//                         tickLine={false} 
//                         tick={{fontSize: 12, fill: '#94a3b8'}} 
//                         dy={10}
//                     />
//                     <YAxis 
//                         hide 
//                         domain={[0, 100]} 
//                     />
//                     <Tooltip 
//                         contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
//                         cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
//                     />
//                     <Area 
//                         type="monotone" 
//                         dataKey="rate" 
//                         stroke="#3b82f6" 
//                         strokeWidth={3}
//                         fillOpacity={1} 
//                         fill="url(#colorRate)" 
//                         activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
//                     />
//                   </AreaChart>
//                 </ResponsiveContainer>
//               ) : (
//                 <div className="h-full flex items-center justify-center text-slate-400 text-sm">
//                   No chart data available
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* --- 3. MEDICINE BREAKDOWN --- */}
//           <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100">
//             <div className="p-6 border-b border-slate-50">
//               <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
//                 <Pill className="text-purple-500" size={20} /> Medicine Performance
//               </h2>
//               <p className="text-xs text-slate-400 mt-1">Detailed breakdown by medicine</p>
//             </div>
            
//             <div className="p-6 space-y-5">
//               {trackingData.medicineBreakdown?.length > 0 ? (
//                 trackingData.medicineBreakdown.map((medicine, index) => (
//                   <div key={index}>
//                     <div className="flex justify-between items-end mb-2">
//                         <div className="flex items-center gap-3">
//                             <div 
//                                 className="w-3 h-3 rounded-full shadow-sm ring-2 ring-white"
//                                 style={{ backgroundColor: medicine.color || '#3b82f6' }}
//                             ></div>
//                             <div>
//                                 <p className="text-sm font-bold text-slate-800">{medicine.name}</p>
//                                 <p className="text-[10px] text-slate-400">{medicine.doses} doses/day</p>
//                             </div>
//                         </div>
//                         <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${getAdherenceColor(medicine.adherence)}`}>
//                             {medicine.adherence}%
//                         </span>
//                     </div>
//                     {/* Native-style Progress Bar */}
//                     <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
//                         <div 
//                             className={`h-full rounded-full transition-all duration-1000 ${getProgressBarColor(medicine.adherence)}`}
//                             style={{ width: `${medicine.adherence}%` }}
//                         ></div>
//                     </div>
//                   </div>
//                 ))
//               ) : (
//                 <div className="text-center py-10">
//                   <span className="text-4xl block mb-2 opacity-50">📊</span>
//                   <p className="text-slate-400 text-sm">No medicine data yet</p>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* --- 4. INSIGHTS SECTION --- */}
//         <div className="pt-4">
//             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">Daily Insights</h3>
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
//                 <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 relative overflow-hidden">
//                     <Award className="text-4xl text-emerald-200 absolute -bottom-2 -right-2" />
//                     <div className="relative z-10">
//                         <h4 className="font-bold text-emerald-800 text-sm mb-1">Great Job!</h4>
//                         <p className="text-xs text-emerald-600 leading-relaxed">
//                             Your consistency is key to better health. Keep maintaining that streak!
//                         </p>
//                     </div>
//                 </div>

//                 <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 relative overflow-hidden">
//                     <Lightbulb className="text-4xl text-blue-200 absolute -bottom-2 -right-2" />
//                     <div className="relative z-10">
//                         <h4 className="font-bold text-blue-800 text-sm mb-1">Did you know?</h4>
//                         <p className="text-xs text-blue-600 leading-relaxed">
//                             Taking meds at the same time every day improves effectiveness by 20%.
//                         </p>
//                     </div>
//                 </div>

//                 <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 relative overflow-hidden">
//                     <Target className="text-4xl text-purple-200 absolute -bottom-2 -right-2" />
//                     <div className="relative z-10">
//                         <h4 className="font-bold text-purple-800 text-sm mb-1">Next Goal</h4>
//                         <p className="text-xs text-purple-600 leading-relaxed">
//                             Try to hit a perfect 100% adherence score for 3 days in a row!
//                         </p>
//                     </div>
//                 </div>

//             </div>
//         </div>

//       </div>
//     </div>
//   );
// };

// export default HealthTracking;
