const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Your existing auth middleware
const Report = require('../models/Report');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Config Multer Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'medmind_reports',
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
  },
});
const upload = multer({ storage: storage });

// --- ROUTES ---

// GET: Fetch all reports for user
router.get('/', auth, async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

// POST: Upload new report
router.post('/', [auth, upload.array('images', 10)], async (req, res) => {
  try {
    // req.file is provided by multer-storage-cloudinary
    // req.body contains text fields
    const { title, category, date } = req.body;

    // Process the array of uploaded files
    const pages = req.files.map(file => ({
        imageUrl: file.path,
        cloudinaryId: file.filename
    }));

    const newReport = new Report({
      userId: req.user.id,
      title,
      category,
      pages: pages, // <--- This array contains all the imageUrls and IDs
      date: date || Date.now()
    });

    const report = await newReport.save();
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// DELETE: Remove report
router.delete('/:id', auth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ msg: 'Report not found' });

    // Check user ownership
    if (report.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    // Delete ALL images from Cloudinary
    if (report.pages && report.pages.length > 0) {
        const deletePromises = report.pages.map(page => 
            cloudinary.uploader.destroy(page.cloudinaryId)
        );
        await Promise.all(deletePromises);
    }

    await report.deleteOne();
    res.json({ msg: 'Report removed' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;