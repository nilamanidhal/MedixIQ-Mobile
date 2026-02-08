router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // 1. GET RANGE FROM FRONTEND (Default to 7)
    const range = parseInt(req.query.range) || 7;

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
        // (Assuming you store date as ISO or Date object in DB)
        const dayLogs = logs.filter(l => {
            const logDate = new Date(l.date).toISOString().split('T')[0];
            return logDate === dateString;
        });

        let rate = 0;
        let status = 'neutral';

        if (dayLogs.length === 0) {
            // 🟢 CRITICAL: No meds scheduled for this day
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
            doses: med.times.length, // Doses per day (static from medicine info)
            adherence: rate
        };
    });

    // ==========================================
    // 📤 SEND RESPONSE
    // ==========================================
    res.json({
        adherenceRate,
        totalMedicines: medicines.length, // All time added (or active)
        activeMedicines: medicines.filter(m => m.isActive && !m.isPaused).length,
        weeklyProgress: progressData, // Renamed in frontend to just 'data' usually, but keep name for compatibility
        medicineBreakdown
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});











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
