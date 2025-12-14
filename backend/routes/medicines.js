const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');
const MedicineLog = require('../models/MedicineLog');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/* =========================================================
   LOGS ROUTES (Specific)
   ========================================================= */

// 1. GET FULL HISTORY
router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const logs = await MedicineLog.find({ userId: req.user._id })
      .populate('medicineId', 'name dose')
      .sort({ createdAt: -1 });
    res.json({ logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching logs' });
  }
});

// 2. CREATE LOG (From Offline Sync)
router.post('/logs', authMiddleware, async (req, res) => {
  try {
    const { clientLogId, medicineClientId, status, date, time } = req.body;

    // 🔎 Find Medicine (Handle both Real ID and Client ID)
    const medicine = await Medicine.findOne({
      userId: req.user._id,
      $or: [
          { clientId: medicineClientId },
          { _id: (medicineClientId && medicineClientId.match(/^[0-9a-fA-F]{24}$/) ? medicineClientId : null) }
      ]
    });

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found for log' });
    }

    // 🔁 Idempotency Check: Does this log already exist?
    // We check by clientLogId OR by date/time/medicine combo to prevent duplicates
    let existingLog = await MedicineLog.findOne({ 
        userId: req.user._id, 
        $or: [
            { clientLogId: clientLogId },
            { medicineId: medicine._id, date: new Date(date), time: time }
        ]
    });

    if (existingLog) {
      // If log exists, UPDATE the status!
      if (existingLog.status !== status) {
          existingLog.status = status;
          await existingLog.save();
      }
      return res.json({ log: existingLog });
    }

    // Create New Log
    const log = new MedicineLog({
      userId: req.user._id,
      clientLogId,
      medicineClientId,
      medicineId: medicine._id,
      status,
      date: new Date(date),
      time
    });

    await log.save();
    res.status(201).json({ log });

  } catch (err) {
    console.error("Create Log Error:", err);
    res.status(500).json({ message: 'Error creating log' });
  }
});

// 3. UPDATE LOG STATUS
router.put('/logs/:logId', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const { logId } = req.params;

    // Handle temporary/invalid IDs gracefully
    if (!mongoose.Types.ObjectId.isValid(logId)) {
        return res.status(404).json({ message: 'Invalid Log ID format' });
    }

    const log = await MedicineLog.findOne({ _id: logId, userId: req.user._id });

    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    log.status = status;
    await log.save();

    res.json({ log });
  } catch (err) {
    console.error("Update Log Error:", err);
    res.status(500).json({ message: 'Error updating log' });
  }
});


/* ---------------------------------------------------------
   MEDICINE ROUTES (Generic)
   --------------------------------------------------------- */

// GET ALL MEDICINES
router.get('/', authMiddleware, async (req, res) => {
  try {
    const medicines = await Medicine.find({ userId: req.user._id, isActive: true }).sort({ createdAt: -1 });
    res.json({ medicines });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching medicines' });
  }
});

// ADD MEDICINE
router.post('/', authMiddleware, [
    body('name').notEmpty(),
    body('dose').notEmpty(),
    body('times').isArray({ min: 1 }),
    body('duration.startDate').isISO8601(),
    body('duration.endDate').isISO8601()
  ], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { clientId, name, dose, times, duration, notes } = req.body;

    // Idempotency Check
    const existing = await Medicine.findOne({ userId: req.user._id, clientId });
    if (existing) return res.json({ medicine: existing });

    const medicine = new Medicine({
      userId: req.user._id,
      clientId,
      name,
      dose,
      times,
      duration: { startDate: new Date(duration.startDate), endDate: new Date(duration.endDate) },
      notes
    });

    await medicine.save();
    res.status(201).json({ medicine });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error adding medicine' });
  }
});

// GET SINGLE MEDICINE
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Invalid ID' });
    const medicine = await Medicine.findOne({ _id: req.params.id, userId: req.user._id });
    if (!medicine) return res.status(404).json({ message: 'Medicine not found' });
    res.json({ medicine });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// UPDATE MEDICINE
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Invalid ID' });
    const medicine = await Medicine.findOne({ _id: req.params.id, userId: req.user._id });
    if (!medicine) return res.status(404).json({ message: 'Medicine not found' });
    Object.assign(medicine, req.body);
    await medicine.save();
    res.json({ medicine });
  } catch (err) { res.status(500).json({ message: 'Error updating medicine' }); }
});

// DELETE MEDICINE
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Invalid ID' });
    const medicine = await Medicine.findOne({ _id: req.params.id, userId: req.user._id });
    if (!medicine) return res.status(404).json({ message: 'Medicine not found' });
    medicine.isActive = false;
    await medicine.save();
    res.json({ message: 'Medicine deleted' });
  } catch (err) { res.status(500).json({ message: 'Error deleting medicine' }); }
});

module.exports = router;








// const express = require('express');
// const { body, validationResult } = require('express-validator');
// const Medicine = require('../models/Medicine');
// const MedicineLog = require('../models/MedicineLog');
// const authMiddleware = require('../middleware/auth');

// const router = express.Router();

// /* =========================================================
//    GET ALL MEDICINES (ONLINE SYNC)
//    ========================================================= */
// router.get('/', authMiddleware, async (req, res) => {
//   try {
//     const medicines = await Medicine.find({
//       userId: req.user._id,
//       isActive: true
//     }).sort({ createdAt: -1 });

//     res.json({ medicines });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error fetching medicines' });
//   }
// });

// /* =========================================================
//    ADD MEDICINE (OFFLINE SAFE / IDEMPOTENT)
//    ========================================================= */
// router.post(
//   '/',
//   authMiddleware,
//   [
//     body('clientId').notEmpty().withMessage('clientId is required'),
//     body('name').notEmpty(),
//     body('dose').notEmpty(),
//     body('times').isArray({ min: 1 }),
//     body('duration.startDate').isISO8601(),
//     body('duration.endDate').isISO8601()
//   ],
//   async (req, res) => {
//     try {
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         return res.status(400).json({ errors: errors.array() });
//       }

//       const { clientId, name, dose, times, duration, notes } = req.body;

//       // 🔁 Prevent duplicate creation (important for sync retry)
//       const existing = await Medicine.findOne({
//         userId: req.user._id,
//         clientId
//       });

//       if (existing) {
//         return res.json({ medicine: existing });
//       }

//       const medicine = new Medicine({
//         userId: req.user._id,
//         clientId,
//         name,
//         dose,
//         times,
//         duration: {
//           startDate: new Date(duration.startDate),
//           endDate: new Date(duration.endDate)
//         },
//         notes
//       });

//       await medicine.save();
//       res.status(201).json({ medicine });
//     } catch (err) {
//       console.error(err);
//       res.status(500).json({ message: 'Error adding medicine' });
//     }
//   }
// );

// /* =========================================================
//    UPDATE MEDICINE
//    ========================================================= */
// router.put('/:id', authMiddleware, async (req, res) => {
//   try {
//     const medicine = await Medicine.findOne({
//       _id: req.params.id,
//       userId: req.user._id
//     });

//     if (!medicine) {
//       return res.status(404).json({ message: 'Medicine not found' });
//     }

//     Object.assign(medicine, req.body);
//     await medicine.save();

//     res.json({ medicine });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error updating medicine' });
//   }
// });

// /* =========================================================
//    DELETE MEDICINE (SOFT DELETE)
//    ========================================================= */
// router.delete('/:id', authMiddleware, async (req, res) => {
//   try {
//     const medicine = await Medicine.findOne({
//       _id: req.params.id,
//       userId: req.user._id
//     });

//     if (!medicine) {
//       return res.status(404).json({ message: 'Medicine not found' });
//     }

//     medicine.isActive = false;
//     await medicine.save();

//     res.json({ message: 'Medicine deleted' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error deleting medicine' });
//   }
// });

// /* =========================================================
//    ADD / SYNC MEDICINE LOG (🔥 MOST IMPORTANT FIX)
//    ========================================================= */
// router.post('/logs', authMiddleware, async (req, res) => {
//   try {
//     const { clientLogId, medicineClientId, status, date, time } = req.body;

//     if (!clientLogId || !medicineClientId) {
//       return res.status(400).json({ message: 'Invalid log data' });
//     }

//     // 🔁 Prevent duplicate log creation
//     const existingLog = await MedicineLog.findOne({
//       userId: req.user._id,
//       clientLogId
//     });

//     if (existingLog) {
//       return res.json({ log: existingLog });
//     }

//     // 🔎 Find medicine using clientId (offline-safe)
//     const medicine = await Medicine.findOne({
//       userId: req.user._id,
//       clientId: medicineClientId
//     });

//     if (!medicine) {
//       return res.status(404).json({ message: 'Medicine not found for log' });
//     }

//     const log = new MedicineLog({
//       userId: req.user._id,
//       clientLogId,
//       medicineClientId,
//       medicineId: medicine._id,
//       status,
//       date: new Date(date),
//       time
//     });

//     await log.save();
//     res.status(201).json({ log });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error creating log' });
//   }
// });

// /* =========================================================
//    GET FULL HISTORY (ONLINE ONLY)
//    ========================================================= */
// router.get('/logs', authMiddleware, async (req, res) => {
//   try {
//     const logs = await MedicineLog.find({
//       userId: req.user._id
//     })
//       .populate('medicineId', 'name dose')
//       .sort({ createdAt: -1 });

//     res.json({ logs });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error fetching logs' });
//   }
// });

// /* =========================================================
//    UPDATE LOG STATUS (TAKEN / MISSED)
//    ========================================================= */
// router.put('/logs/:logId', authMiddleware, async (req, res) => {
//   try {
//     const { status } = req.body;

//     if (!['taken', 'missed'].includes(status)) {
//       return res.status(400).json({ message: 'Invalid status' });
//     }

//     const log = await MedicineLog.findOne({
//       _id: req.params.logId,
//       userId: req.user._id
//     });

//     if (!log) {
//       return res.status(404).json({ message: 'Log not found' });
//     }

//     log.status = status;
//     await log.save();

//     res.json({ log });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error updating log' });
//   }
// });

// module.exports = router;








// const express = require('express');
// const { body, validationResult } = require('express-validator');
// const Medicine = require('../models/Medicine');
// const MedicineLog = require('../models/MedicineLog');
// const authMiddleware = require('../middleware/auth');

// const router = express.Router();

// /* =========================================================
//    HISTORY ROUTES (placed BEFORE "/:id" to avoid conflict)
// ========================================================= */

// // ✅ Fetch all history logs for user
// router.get('/logs', authMiddleware, async (req, res) => {
//   try {
//     const logs = await MedicineLog.find({ userId: req.user._id })
//       .populate('medicineId', 'name dose')
//       .sort({ date: -1, time: -1 });

//     res.json({ logs });
//   } catch (error) {
//     console.error("Logs fetch error:", error);
//     res.status(500).json({ message: 'Error fetching logs' });
//   }
// });

// // ✅ Manually log a dose (if you want)
// router.post('/log/:id', authMiddleware, async (req, res) => {
//   try {
//     const { date, time, status } = req.body; // "taken" | "missed"

//     // Prevent duplicate logs for same dose
//     const existing = await MedicineLog.findOne({
//       userId: req.user._id,
//       medicineId: req.params.id,
//       date: new Date(date),
//       time
//     });

//     if (existing) {
//       return res.status(400).json({ message: 'Already logged for this dose' });
//     }

//     const log = new MedicineLog({
//       userId: req.user._id,
//       medicineId: req.params.id,
//       date,
//       time,
//       status
//     });

//     await log.save();
//     res.json({ message: `Marked as ${status}`, log });
//   } catch (error) {
//     console.error("Error logging dose:", error);
//     res.status(500).json({ message: 'Error logging dose' });
//   }
// });

// /* =========================================================
//    MEDICINE ROUTES
// ========================================================= */

// // Get all medicines for authenticated user
// router.get('/', authMiddleware, async (req, res) => {
//   try {
//     const medicines = await Medicine.find({ 
//       userId: req.user._id,
//       isActive: true 
//     }).sort({ createdAt: -1 });
    
//     res.json({ medicines });
//   } catch (error) {
//     console.error('Fetch medicines error:', error);
//     res.status(500).json({ message: 'Server error fetching medicines' });
//   }
// });

// // Get single medicine by ID
// router.get('/:id', authMiddleware, async (req, res) => {
//   try {
//     const medicine = await Medicine.findOne({
//       _id: req.params.id,
//       userId: req.user._id
//     });

//     if (!medicine) {
//       return res.status(404).json({ message: 'Medicine not found' });
//     }

//     res.json({ medicine });
//   } catch (error) {
//     console.error('Fetch medicine error:', error);
//     res.status(500).json({ message: 'Server error fetching medicine' });
//   }
// });

// // Add new medicine
// router.post('/', authMiddleware, [
//   body('name').trim().notEmpty().withMessage('Medicine name is required'),
//   body('dose').trim().notEmpty().withMessage('Dose is required'),
//   body('times').isArray({ min: 1 }).withMessage('At least one time is required'),
//   body('times.*').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
//   body('duration.startDate').isISO8601().withMessage('Valid start date is required'),
//   body('duration.endDate').isISO8601().withMessage('Valid end date is required'),
//   body('notes').optional().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ 
//         message: 'Validation failed', 
//         errors: errors.array() 
//       });
//     }

//     const { name, dose, times, duration, notes } = req.body;

//     const startDate = new Date(duration.startDate);
//     const endDate = new Date(duration.endDate);
    
//     if (endDate <= startDate) {
//       return res.status(400).json({ message: 'End date must be after start date' });
//     }

//     const medicine = new Medicine({
//       userId: req.user._id,
//       name,
//       dose,
//       times,
//       duration: { startDate, endDate },
//       notes
//     });

//     await medicine.save();

//     res.status(201).json({
//       message: 'Medicine added successfully',
//       medicine
//     });
//   } catch (error) {
//     console.error('Add medicine error:', error);
//     res.status(500).json({ message: 'Server error adding medicine' });
//   }
// });

// // Update medicine
// router.put('/:id', authMiddleware, [
//   body('name').optional().trim().notEmpty(),
//   body('dose').optional().trim().notEmpty(),
//   body('times').optional().isArray({ min: 1 }),
//   body('times.*').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
//   body('duration.startDate').optional().isISO8601(),
//   body('duration.endDate').optional().isISO8601(),
//   body('notes').optional().isLength({ max: 500 })
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
//     }

//     const { name, dose, times, duration, notes } = req.body;

//     const medicine = await Medicine.findOne({
//       _id: req.params.id,
//       userId: req.user._id
//     });

//     if (!medicine) {
//       return res.status(404).json({ message: 'Medicine not found' });
//     }

//     if (name) medicine.name = name;
//     if (dose) medicine.dose = dose;
//     if (times) medicine.times = times;
//     if (notes !== undefined) medicine.notes = notes;
    
//     if (duration) {
//       const startDate = new Date(duration.startDate);
//       const endDate = new Date(duration.endDate);
      
//       if (endDate <= startDate) {
//         return res.status(400).json({ message: 'End date must be after start date' });
//       }
      
//       medicine.duration.startDate = startDate;
//       medicine.duration.endDate = endDate;
//     }

//     await medicine.save();

//     res.json({ message: 'Medicine updated successfully', medicine });
//   } catch (error) {
//     console.error('Update medicine error:', error);
//     res.status(500).json({ message: 'Server error updating medicine' });
//   }
// });

// // Delete medicine (soft delete)
// router.delete('/:id', authMiddleware, async (req, res) => {
//   try {
//     const medicine = await Medicine.findOne({
//       _id: req.params.id,
//       userId: req.user._id
//     });

//     if (!medicine) {
//       return res.status(404).json({ message: 'Medicine not found' });
//     }

//     medicine.isActive = false;
//     await medicine.save();

//     res.json({ message: 'Medicine deleted successfully' });
//   } catch (error) {
//     console.error('Delete medicine error:', error);
//     res.status(500).json({ message: 'Server error deleting medicine' });
//   }
// });

// /* =========================================================
//    TAKEN / MISSED with auto-logging
// ========================================================= */

// // Mark medicine as taken
// // Mark medicine as taken
// router.put('/:id/taken', authMiddleware, async (req, res) => {
//   try {
//     const medicine = await Medicine.findOne({
//       _id: req.params.id,
//       userId: req.user._id,
//       isActive: true,
//     });

//     if (!medicine) {
//       return res.status(404).json({ message: 'Medicine not found' });
//     }

//     medicine.status = 'taken';
//     medicine.lastTaken = new Date();
//     await medicine.save();

//     const now = new Date();
//     const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

//     const log = new MedicineLog({
//       userId: req.user._id,
//       medicineId: medicine._id,
//       date: dateOnly,
//       time: now.toTimeString().slice(0, 5),
//       status: 'taken'
//     });

//     // 👇 Debug logs
//     console.log("🟢 User:", req.user._id);
//     console.log("🟢 Medicine:", medicine._id);
//     console.log("🟢 About to save log:", log);

//     await log.save();

//     res.json({ message: 'Medicine marked as taken ✅', medicine, log });
//   } catch (error) {
//     console.error('❌ Mark as taken error:', error);
//     res.status(500).json({ message: 'Server error marking as taken' });
//   }
// });



// // Mark medicine as missed
// // Mark medicine as missed
// router.put('/:id/missed', authMiddleware, async (req, res) => {
//   try {
//     const medicine = await Medicine.findOne({
//       _id: req.params.id,
//       userId: req.user._id,
//       isActive: true,
//     });

//     if (!medicine) {
//       return res.status(404).json({ message: 'Medicine not found' });
//     }

//     // Update medicine status
//     medicine.status = 'missed';
//     medicine.lastMissed = new Date();
//     await medicine.save();

//     // Normalize date
//     const now = new Date();
//     const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

//     // Create log entry
//     const log = new MedicineLog({
//       userId: req.user._id,
//       medicineId: medicine._id,
//       date: dateOnly,
//       time: now.toTimeString().slice(0, 5), // HH:mm
//       status: 'missed'
//     });

//      // 👇 Debug logs
//     console.log("🟢 User:", req.user._id);
//     console.log("🟢 Medicine:", medicine._id);
//     console.log("🟢 About to save log:", log);
//     await log.save();

//     res.json({ message: 'Medicine marked as missed 📝', medicine, log });
//   } catch (error) {
//     console.error('Mark as missed error:', error);
//     res.status(500).json({ message: 'Server error marking as missed' });
//   }
// });


// module.exports = router;
