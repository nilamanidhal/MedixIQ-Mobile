const express = require('express');
const authMiddleware = require('../middleware/auth');
const Medicine = require('../models/Medicine');
const MedicineLog = require('../models/MedicineLog');

const router = express.Router();

// ✅ Get adherence & tracking stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // fetch medicines of user
    const medicines = await Medicine.find({ userId: req.user._id, isActive: true });
    
    // fetch logs (only last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const logs = await MedicineLog.find({
      userId: req.user._id,
      date: { $gte: sevenDaysAgo }
    }).populate('medicineId', 'name dose times duration');

    // overall adherence
    const totalTaken = logs.filter(l => l.status === 'taken').length;
    const totalMissed = logs.filter(l => l.status === 'missed').length;
    const total = totalTaken + totalMissed;
    const adherenceRate = total > 0 ? Math.round((totalTaken / total) * 100) : 0;

    // weekly progress (group logs by day)
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const weeklyProgress = days.map(day => {
      const dayLogs = logs.filter(l => new Date(l.date).getDay() === days.indexOf(day));
      const taken = dayLogs.filter(l => l.status === 'taken').length;
      const missed = dayLogs.filter(l => l.status === 'missed').length;
      const total = taken + missed;
      return {
        day,
        rate: total > 0 ? Math.round((taken / total) * 100) : 0,
        doses: total
      };
    });

    // medicine breakdown
    const medicineMap = {};
    for (let log of logs) {
      const medId = log.medicineId?._id?.toString();
      if (!medId) continue;
      if (!medicineMap[medId]) {
        medicineMap[medId] = {
          name: log.medicineId.name,
          doses: log.medicineId.times?.length || 1,
          taken: 0,
          missed: 0
        };
      }
      if (log.status === 'taken') medicineMap[medId].taken++;
      else if (log.status === 'missed') medicineMap[medId].missed++;
    }

    const medicineBreakdown = Object.values(medicineMap).map((m, i) => ({
      ...m,
      adherence: (m.taken + m.missed) > 0 ? Math.round((m.taken / (m.taken + m.missed)) * 100) : 0,
      color: `hsl(${(i * 60) % 360}, 70%, 60%)`
    }));

    // active medicines = only those still within duration
    const today = new Date();
    const activeMedicines = medicines.filter(m => m.duration.endDate >= today).length;

    res.json({
      adherenceRate,
      totalMedicines: medicines.length,
      activeMedicines,
      weeklyProgress,
      medicineBreakdown
    });

  } catch (err) {
    console.error('Tracking stats error:', err);
    res.status(500).json({ message: 'Error generating tracking stats' });
  }
});

module.exports = router;
