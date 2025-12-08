const cron = require('node-cron');
const Medicine = require('../models/Medicine');
const MedicineLog = require('../models/MedicineLog');
const { sendMedicineReminder } = require('../routes/notifications'); // Keep as you said

const activeCronJobs = new Map();
let isJobRunning = false;

// === THIS IS THE FIX ===
// This guard ensures the service can only be started one time.
let isServiceStarted = false;
// =======================

/**
 * 🕒 Helper: get the current Date object for the India (IST) timezone
 */
const getIndiaDate = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

/**
 * 💾 Backfill missed logs for the last 7 days (skipping today)
 */
const backfillMissedLogs = async () => {
  try {
    const now = getIndiaDate();
    console.log('💾 Running log backfill, current IST is:', now.toLocaleString());

    // Start loop from d = 1 (yesterday) to avoid collisions with today's cron job
    for (let d = 1; d < 7; d++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() - d);
      const dateString = checkDate.toDateString();

      const medicines = await Medicine.find({
        isActive: true,
        'duration.startDate': { $lte: checkDate },
        'duration.endDate': { $gte: checkDate },
      });

      for (const medicine of medicines) {
        for (const time of medicine.times) {
          const [hour, minute] = time.split(':').map(Number);
          const doseTime = new Date(dateString);
          doseTime.setHours(hour, minute, 0, 0);

          if (doseTime < now) {
            const exists = await MedicineLog.findOne({
              userId: medicine.userId,
              medicineId: medicine._id,
              date: new Date(dateString),
              time,
            });

            if (!exists) {
              await MedicineLog.create({
                userId: medicine.userId,
                medicineId: medicine._id,
                date: new Date(dateString),
                time,
                status: 'pending',
              });
              console.log(`💾 Backfilled log for ${medicine.name} on ${dateString} at ${time}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in backfillMissedLogs:', error);
  }
};

/**
 * 🚀 Start all cron jobs
 */
const startCronJobs = () => {
  // === THIS IS THE FIX ===
  // If this function is called a 2nd or 3rd time, it will stop here.
  if (isServiceStarted) {
    console.log('⚠️ Cron service is already running. Skipping duplicate start.');
    return;
  }
  isServiceStarted = true;
  // =======================

  console.log('🚀 Starting cron service...');
  backfillMissedLogs();

  const cronJob = cron.schedule(
    '* * * * *', // Every minute
    async () => {
      if (isJobRunning) {
        console.log('⚠️ Cron job skipped: Previous job still running.');
        return;
      }
      isJobRunning = true;

      try {
        const now = getIndiaDate();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentDate = now.toDateString();

        console.log(`⏰ [${currentDate} ${currentTime}] Running cron check...`);

        const medicines = await Medicine.find({
          isActive: true,
          'duration.startDate': { $lte: now },
          'duration.endDate': { $gte: now },
          times: currentTime,
        }).populate('userId', 'name email subscription');

        for (const medicine of medicines) {
          // 🧠 Check if log already exists (to avoid duplicate reminders)
          const existingLog = await MedicineLog.findOne({
            userId: medicine.userId._id,
            medicineId: medicine._id,
            date: new Date(currentDate),
            time: currentTime,
          });

          if (!existingLog) {
            // ✅ Create log first (this ensures single reminder per time)
            await MedicineLog.create({
              userId: medicine.userId._id,
              medicineId: medicine._id,
              date: new Date(currentDate),
              time: currentTime,
              status: 'pending',
            });
            console.log(`📌 Created log for ${medicine.name} at ${currentTime}`);

            // 🔔 Send notification AFTER log creation
            if (medicine.userId && medicine.userId.subscription) {
              await sendMedicineReminder(medicine.userId._id, medicine.name, medicine.dose);
              console.log(`🔔 Reminder sent for ${medicine.name} to ${medicine.userId.name} at ${currentTime}`);
            }
          } else {
            console.log(`⏳ Skipping duplicate reminder for ${medicine.name}`);
          }
        }

        if (medicines.length > 0) {
          console.log(`✅ Processed ${medicines.length} reminders at ${currentTime}`);
        }
      } catch (error) {
        console.error('❌ Error in cron job:', error);
      } finally {
        isJobRunning = false;
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata',
    }
  );

  activeCronJobs.set('medicine-reminders', cronJob);
  console.log('✅ Medicine reminder cron job started (IST)');
};

/**
 * 🛑 Stop cron jobs gracefully
 */
const stopCronJobs = () => {
  activeCronJobs.forEach((job, name) => {
    job.destroy();
    console.log(`🛑 Stopped cron job: ${name}`);
  });
  activeCronJobs.clear();
};

process.on('SIGTERM', stopCronJobs);
process.on('SIGINT', stopCronJobs);

module.exports = {
  startCronJobs,
  stopCronJobs,
};






// const cron = require('node-cron');
// const Medicine = require('../models/Medicine');
// const MedicineLog = require('../models/MedicineLog');
// const { sendMedicineReminder } = require('../routes/notifications');

// const activeCronJobs = new Map();

// /**
//  * Helper: get India (IST) time correctly
//  */
// const getIndiaDate = () => {
//   const now = new Date();
//   const indiaOffset = 5.5 * 60 * 60 * 1000; // +5:30
//   return new Date(now.getTime() + indiaOffset - now.getTimezoneOffset() * 60000);
// };

// /**
//  * Backfill missed logs for the last 7 days
//  */
// const backfillMissedLogs = async () => {
//   try {
//     const now = getIndiaDate();

//     for (let d = 0; d < 7; d++) {
//       const checkDate = new Date(now);
//       checkDate.setDate(now.getDate() - d);
//       const dateString = checkDate.toDateString();

//       const medicines = await Medicine.find({
//         isActive: true,
//         'duration.startDate': { $lte: checkDate },
//         'duration.endDate': { $gte: checkDate },
//       });

//       for (const medicine of medicines) {
//         for (const time of medicine.times) {
//           const [hour, minute] = time.split(':').map(Number);
//           const doseTime = new Date(dateString);
//           doseTime.setHours(hour, minute, 0, 0);

//           if (doseTime < now) {
//             const exists = await MedicineLog.findOne({
//               userId: medicine.userId,
//               medicineId: medicine._id,
//               date: new Date(dateString),
//               time,
//             });

//             if (!exists) {
//               await MedicineLog.create({
//                 userId: medicine.userId,
//                 medicineId: medicine._id,
//                 date: new Date(dateString),
//                 time,
//                 status: 'pending',
//               });
//               console.log(`💾 Backfilled log for ${medicine.name} on ${dateString} at ${time}`);
//             }
//           }
//         }
//       }
//     }
//   } catch (error) {
//     console.error('❌ Error in backfillMissedLogs:', error);
//   }
// };

// /**
//  * Start all cron jobs
//  */
// const startCronJobs = () => {
//   console.log('🚀 Starting cron service...');
//   backfillMissedLogs();

//   const cronJob = cron.schedule(
//     '* * * * *',
//     async () => {
//       try {
//         const now = getIndiaDate();
//         const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
//           now.getMinutes()
//         ).padStart(2, '0')}`;
//         const currentDate = now.toDateString();

//         console.log(`⏰ [${currentDate} ${currentTime}] Running cron check...`);

//         const medicines = await Medicine.find({
//           isActive: true,
//           'duration.startDate': { $lte: now },
//           'duration.endDate': { $gte: now },
//           times: currentTime,
//         }).populate('userId', 'name email subscription');

//         for (const medicine of medicines) {
//           // 🔔 Send push notification
//           if (medicine.userId && medicine.userId.subscription) {
//             await sendMedicineReminder(medicine.userId._id, medicine.name, medicine.dose);
//             console.log(`🔔 Reminder sent for ${medicine.name} to ${medicine.userId.name} at ${currentTime}`);
//           }

//           // 📌 Create pending log
//           const exists = await MedicineLog.findOne({
//             userId: medicine.userId._id,
//             medicineId: medicine._id,
//             date: new Date(currentDate),
//             time: currentTime,
//           });

//           if (!exists) {
//             await MedicineLog.create({
//               userId: medicine.userId._id,
//               medicineId: medicine._id,
//               date: new Date(currentDate),
//               time: currentTime,
//               status: 'pending',
//             });
//             console.log(`📌 Pending log created for ${medicine.name} at ${currentTime}`);
//           }
//         }

//         if (medicines.length > 0) {
//           console.log(`✅ Processed ${medicines.length} reminders at ${currentTime}`);
//         }
//       } catch (error) {
//         console.error('❌ Error in cron job:', error);
//       }
//     },
//     {
//       scheduled: true,
//       timezone: 'Asia/Kolkata', // ✅ run according to Indian time
//     }
//   );

//   activeCronJobs.set('medicine-reminders', cronJob);
//   console.log('✅ Medicine reminder cron job started (IST)');
// };

// /**
//  * Stop cron jobs gracefully
//  */
// const stopCronJobs = () => {
//   activeCronJobs.forEach((job, name) => {
//     job.destroy();
//     console.log(`🛑 Stopped cron job: ${name}`);
//   });
//   activeCronJobs.clear();
// };

// process.on('SIGTERM', stopCronJobs);
// process.on('SIGINT', stopCronJobs);

// module.exports = {
//   startCronJobs,
//   stopCronJobs,
// };







// const cron = require('node-cron');
// const Medicine = require('../models/Medicine');
// const MedicineLog = require('../models/MedicineLog');
// const { sendMedicineReminder } = require('../routes/notifications');

// const activeCronJobs = new Map();

// /**
//  * Backfill missed logs for the last 7 days
//  */
// const backfillMissedLogs = async () => {
//   try {
//     const now = new Date();

//     // Loop through last 7 days
//     for (let d = 0; d < 7; d++) {
//       const checkDate = new Date();
//       checkDate.setDate(now.getDate() - d);
//       const dateString = checkDate.toDateString();

//       const medicines = await Medicine.find({
//         isActive: true,
//         'duration.startDate': { $lte: checkDate },
//         'duration.endDate': { $gte: checkDate }
//       });

//       for (const medicine of medicines) {
//         for (const time of medicine.times) {
//           const [hour, minute] = time.split(':').map(Number);
//           const doseTime = new Date(dateString);
//           doseTime.setHours(hour, minute, 0, 0);

//           // Only create log if the dose time has already passed
//           if (doseTime < now) {
//             const exists = await MedicineLog.findOne({
//               userId: medicine.userId,
//               medicineId: medicine._id,
//               date: new Date(dateString),
//               time
//             });

//             if (!exists) {
//               await MedicineLog.create({
//                 userId: medicine.userId,
//                 medicineId: medicine._id,
//                 date: new Date(dateString),
//                 time,
//                 status: 'pending'
//               });
//               console.log(`💾 Backfilled log for ${medicine.name} on ${dateString} at ${time}`);
//             }
//           }
//         }
//       }
//     }
//   } catch (error) {
//     console.error("❌ Error in backfillMissedLogs:", error);
//   }
// };

// const startCronJobs = () => {
//   console.log('🚀 Starting cron service...');

//   // ✅ Run backfill immediately when server starts
//   backfillMissedLogs();

//   // Check for medicine reminders every minute
//   const cronJob = cron.schedule('* * * * *', async () => {
//     try {
//       const now = new Date();
//       const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
//       const currentDate = now.toDateString();

//       // Find medicines that need reminders at current time
//       const medicines = await Medicine.find({
//         isActive: true,
//         'duration.startDate': { $lte: now },
//         'duration.endDate': { $gte: now },
//         times: currentTime
//       }).populate('userId', 'name email subscription');

//       for (const medicine of medicines) {
//         // 🔔 Send notification
//         if (medicine.userId && medicine.userId.subscription) {
//           await sendMedicineReminder(
//             medicine.userId._id,
//             medicine.name,
//             medicine.dose
//           );
//           console.log(`🔔 Reminder sent for ${medicine.name} to ${medicine.userId.name} at ${currentTime}`);
//         }

//         // 📌 Create pending log if not exists
//         const exists = await MedicineLog.findOne({
//           userId: medicine.userId._id,
//           medicineId: medicine._id,
//           date: new Date(currentDate),
//           time: currentTime
//         });

//         if (!exists) {
//           await MedicineLog.create({
//             userId: medicine.userId._id,
//             medicineId: medicine._id,
//             date: new Date(currentDate),
//             time: currentTime,
//             status: 'pending'
//           });
//           console.log(`📌 Pending log created for ${medicine.name} at ${currentTime}`);
//         }
//       }

//       if (medicines.length > 0) {
//         console.log(`✅ Processed ${medicines.length} reminders at ${currentTime}`);
//       }
//     } catch (error) {
//       console.error('❌ Error in cron job:', error);
//     }
//   }, {
//     scheduled: true,
//     timezone: "UTC"
//   });

//   activeCronJobs.set('medicine-reminders', cronJob);
//   console.log('✅ Medicine reminder cron job started');
// };

// const stopCronJobs = () => {
//   activeCronJobs.forEach((job, name) => {
//     job.destroy();
//     console.log(`🛑 Stopped cron job: ${name}`);
//   });
//   activeCronJobs.clear();
// };

// // Graceful shutdown
// process.on('SIGTERM', stopCronJobs);
// process.on('SIGINT', stopCronJobs);

// module.exports = {
//   startCronJobs,
//   stopCronJobs
// };
