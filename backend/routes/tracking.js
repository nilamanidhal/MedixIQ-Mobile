const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const MedicineLog = require('../models/MedicineLog');
const Medicine = require('../models/Medicine');

// GET STATS (With 30-day range and Heatmap support)
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // 1. GET RANGE FROM FRONTEND (Default to 7)
    const range = parseInt(req.query.range) || 7;

    // 🔥 THE MISSING PIECE: Actually count all medicines for the lifetime stat!
    const totalMedicinesCount = await Medicine.countDocuments({ userId: req.user._id });
    
    // 2. FETCH MEDICINES (Active only, for the breakdown list)
    const medicines = await Medicine.find({ userId: req.user._id, isActive: true });
    
    // 3. CALCULATE START DATE
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);
    startDate.setHours(0, 0, 0, 0); // Start of that day

    // 4. FETCH LOGS (For the specific range)
    const logs = await MedicineLog.find({
      userId: req.user._id,
      date: { $gte: startDate }
    }).populate('medicineId', 'name dose');

    // ==========================================
    // 📊 LOGIC 1: PROGRESS GRAPH / HEATMAP
    // ==========================================
    const progressData = [];
    
    // Loop backwards from today to 'range' days ago
    for (let i = range - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0]; // "2023-10-25"
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon"

        // Find logs for this specific date
        const dayLogs = logs.filter(l => {
            const logDate = new Date(l.date).toISOString().split('T')[0];
            return logDate === dateString;
        });

        let rate = 0;

        if (dayLogs.length === 0) {
            // 🟢 CRITICAL: No meds scheduled for this day (Rest Day)
            rate = -1; 
        } else {
            const taken = dayLogs.filter(l => l.status === 'taken').length;
            const total = dayLogs.length;
            rate = total > 0 ? Math.round((taken / total) * 100) : 0;
        }

        progressData.push({
            day: dayName,   // "Mon"
            fullDate: dateString, // "2023-10-25"
            rate: rate,     // 100, 50, 0, or -1 (No Meds)
            doses: dayLogs.length
        });
    }

    // ==========================================
    // 📊 LOGIC 2: OVERALL ADHERENCE (Average of the range)
    // ==========================================
    // Only count days where meds were actually scheduled (rate != -1)
    const activeDays = progressData.filter(d => d.rate !== -1);
    const sumRates = activeDays.reduce((acc, curr) => acc + curr.rate, 0);
    const adherenceRate = activeDays.length > 0 
        ? Math.round(sumRates / activeDays.length) 
        : 0;

    // ==========================================
    // 📊 LOGIC 3: MEDICINE BREAKDOWN
    // ==========================================
    const medicineBreakdown = medicines.map(med => {
        // Find logs for this specific medicine in the fetched logs
        const medLogs = logs.filter(l => l.medicineId && l.medicineId._id.toString() === med._id.toString());
        
        const taken = medLogs.filter(l => l.status === 'taken').length;
        const total = medLogs.length;
        const rate = total > 0 ? Math.round((taken / total) * 100) : 0;

        return {
            name: med.name,
            doses: med.times.length, // Doses per day
            adherence: rate
        };
    });

    // ==========================================
    // 📤 SEND RESPONSE
    // ==========================================
res.json({
        adherenceRate,
        totalMedicines: totalMedicinesCount, // 🔥 THE FIX: Use the new total count here!
        activeMedicines: medicines.filter(m => !m.isPaused).length,
        weeklyProgress: progressData, 
        medicineBreakdown
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});


// --- NEW INTELLIGENCE ENDPOINTS ---

// 1. Time Analysis: When does the user forget?
router.get('/time-analysis', authMiddleware, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const logs = await MedicineLog.find({
            userId: req.user._id,
            date: { $gte: thirtyDaysAgo }
        });

        // Initialize slots
        const timeSlots = { 
            morning: { taken: 0, missed: 0 }, 
            afternoon: { taken: 0, missed: 0 }, 
            evening: { taken: 0, missed: 0 }, 
            night: { taken: 0, missed: 0 } 
        };

        logs.forEach(log => {
            if (!log.time) return;
            const hour = parseInt(log.time.split(':')[0]);
            
            let slot = 'night';
            if (hour >= 6 && hour < 12) slot = 'morning';
            else if (hour >= 12 && hour < 16) slot = 'afternoon';
            else if (hour >= 16 && hour < 20) slot = 'evening';

            timeSlots[slot][log.status === 'taken' ? 'taken' : 'missed']++;
        });

        // Find the slot with the highest percentage of misses
        let worstSlot = null;
        let highestMissRate = 0;

        Object.keys(timeSlots).forEach(slot => {
            const data = timeSlots[slot];
            const total = data.taken + data.missed;
            if (total > 0) {
                const missRate = data.missed / total;
                if (missRate > highestMissRate && data.missed > 0) {
                    highestMissRate = missRate;
                    worstSlot = slot;
                }
            }
        });

        res.json({ timeSlots, worstSlot });
    } catch (err) {
        console.error("Time analysis error:", err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// 2. Weekly Pattern: Which day is the weakest?
router.get('/weekly-pattern', authMiddleware, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const logs = await MedicineLog.find({
            userId: req.user._id,
            date: { $gte: thirtyDaysAgo }
        });

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const pattern = days.map(d => ({ day: d, taken: 0, missed: 0, rate: 0 }));

        logs.forEach(log => {
            const dayIndex = new Date(log.date).getDay();
            if (log.status === 'taken') pattern[dayIndex].taken++;
            if (log.status === 'missed') pattern[dayIndex].missed++;
        });

        let worstDay = null;
        let lowestRate = 101; // Start above 100%

        pattern.forEach(p => {
            const total = p.taken + p.missed;
            if (total > 0) {
                p.rate = Math.round((p.taken / total) * 100);
                if (p.rate < lowestRate) {
                    lowestRate = p.rate;
                    worstDay = p;
                }
            }
        });

        res.json({ pattern, worstDay });
    } catch (err) {
        console.error("Weekly pattern error:", err);
        res.status(500).json({ message: 'Server Error' });
    }
});
// 👇 THIS LINE IS CRITICAL. IT WAS LIKELY MISSING.
module.exports = router;










// const express = require('express');
// const authMiddleware = require('../middleware/auth');
// const Medicine = require('../models/Medicine');
// const MedicineLog = require('../models/MedicineLog');

// const router = express.Router();

// // ✅ Get adherence & tracking stats
// router.get('/stats', authMiddleware, async (req, res) => {
//   try {
//     // fetch medicines of user
//     const medicines = await Medicine.find({ userId: req.user._id, isActive: true });
    
//     // fetch logs (only last 7 days)
//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

//     const logs = await MedicineLog.find({
//       userId: req.user._id,
//       date: { $gte: sevenDaysAgo }
//     }).populate('medicineId', 'name dose times duration');

//     // overall adherence
//     const totalTaken = logs.filter(l => l.status === 'taken').length;
//     const totalMissed = logs.filter(l => l.status === 'missed').length;
//     const total = totalTaken + totalMissed;
//     const adherenceRate = total > 0 ? Math.round((totalTaken / total) * 100) : 0;

//     // weekly progress (group logs by day)
//     const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
//     const weeklyProgress = days.map(day => {
//       const dayLogs = logs.filter(l => new Date(l.date).getDay() === days.indexOf(day));
//       const taken = dayLogs.filter(l => l.status === 'taken').length;
//       const missed = dayLogs.filter(l => l.status === 'missed').length;
//       const total = taken + missed;
//       return {
//         day,
//         rate: total > 0 ? Math.round((taken / total) * 100) : 0,
//         doses: total
//       };
//     });

//     // medicine breakdown
//     const medicineMap = {};
//     for (let log of logs) {
//       const medId = log.medicineId?._id?.toString();
//       if (!medId) continue;
//       if (!medicineMap[medId]) {
//         medicineMap[medId] = {
//           name: log.medicineId.name,
//           doses: log.medicineId.times?.length || 1,
//           taken: 0,
//           missed: 0
//         };
//       }
//       if (log.status === 'taken') medicineMap[medId].taken++;
//       else if (log.status === 'missed') medicineMap[medId].missed++;
//     }

//     const medicineBreakdown = Object.values(medicineMap).map((m, i) => ({
//       ...m,
//       adherence: (m.taken + m.missed) > 0 ? Math.round((m.taken / (m.taken + m.missed)) * 100) : 0,
//       color: `hsl(${(i * 60) % 360}, 70%, 60%)`
//     }));

//     // active medicines = only those still within duration
//     const today = new Date();
//     const activeMedicines = medicines.filter(m => m.duration.endDate >= today).length;

//     res.json({
//       adherenceRate,
//       totalMedicines: medicines.length,
//       activeMedicines,
//       weeklyProgress,
//       medicineBreakdown
//     });

//   } catch (err) {
//     console.error('Tracking stats error:', err);
//     res.status(500).json({ message: 'Error generating tracking stats' });
//   }
// });

// module.exports = router;
