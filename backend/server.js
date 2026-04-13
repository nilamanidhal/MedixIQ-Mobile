const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const medicineRoutes = require('./routes/medicines');
const notificationRoutes = require('./routes/notifications');
const trackingRoutes = require('./routes/tracking');
const aiRoutes = require('./routes/aiRoutes');
const { startCronJobs } = require('./services/cronService');
const adminRoutes = require('./routes/admin');
const contactRoutes=require('./routes/contact');
const reportRoutes=require('./routes/reports')
const emergencyRoutes = require('./routes/emergency');
const caregiverRoutes = require('./routes/caregiver');

dotenv.config();
console.log("ENV LOADED:", process.env.VAPID_SUBJECT);
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  "http://localhost:5173", // Dev frontend
  "https://medmind-heathy.netlify.app",
  "https://medmind-heathcare.netlify.app",
  "https://medixiq-admin.netlify.app",
   "http://localhost",
   "capacitor://localhost",
   "https://localhost"
];
app.use(cors({
  origin: allowedOrigins,
  credentials: false,
}));
app.use(express.json());

// Routes
app.use('/', emergencyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact',contactRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/caregiver', caregiverRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'MediMind Backend is running!' });
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medimind', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  // Start cron jobs after DB connection
  // startCronJobs();
})
.catch(err => console.error('MongoDB connection error:', err));

app.get('/ping', (req, res) => {
  res.send('MedMind server alive ✅');
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});