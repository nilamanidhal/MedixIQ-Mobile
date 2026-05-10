# 💊 MedixIQ: Proactive Health & Emergency Response Platform

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=Capacitor&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

**MedixIQ** (formerly Medmind) is a production-grade, offline-first health and emergency response mobile application. Built entirely on free and open-source technologies, it bridges the gap between daily personal health tracking, AI-driven medical insights, and proactive emergency family monitoring. 

It proves that a robust, student-built system can deliver genuine, life-saving value.

---

## ✨ Core Features

### 💊 1. Medicine Management & Tracking
* **Offline-First Logging:** Log doses even in hospital basements with zero internet; auto-syncs when reconnected.
* **Smart Scheduling:** Daily streak analysis and real-time adherence tracking.
* **Exportable Reports:** Generate comprehensive lifetime history PDF reports to share with doctors.

### 📄 2. Digital Prescription Vault
* **Secure Cloud Upload:** Digitize and store physical medical documents.
* **Centralized Retrieval:** Instant access to prescriptions during doctor visits or emergencies.

### 🚨 3. Sentinel Emergency Mode
* **Native Android Crash Detection:** Uses a custom background Java service and the device's `SensorManager` (G-force) to detect severe physical impacts.
* **Zero-Internet SMS Alerts:** Bypasses web APIs to use the native `Telephony API`, sending immediate emergency texts with location coordinates, even without mobile data.

### 🧠 4. AI Health Hub
* **Virtual Medical Assistant:** A 24/7 context-aware chatbot powered by Gemini and Groq models.
* **Automated Safety Checks:** AI silently checks new prescriptions against active medicines to warn users of dangerous drug interactions.

### 👨‍👩‍👧 5. Caregiver Family Ecosystem
* **Secure Access:** Patients generate secure, temporary 15-minute 6-digit access codes.
* **Remote Monitoring:** Family members can view live adherence data, missed doses, and active medications from their own devices.

---

## 🏗️ Technical Architecture

Medmind uses a modern Full-Stack architecture wrapped for mobile using Ionic Capacitor.

* **Frontend:** React.js, Tailwind CSS, Recharts (for data visualization), Lucide React (Icons).
* **Backend:** Node.js, Express.js, JWT Authentication.
* **Database:** MongoDB for flexible, document-based data storage.
* **Mobile Runtime:** Capacitor JS.
* **Native Android Components:** Custom Java implementations (`SentinelService.java`, `BootReceiver.java`, `EmergencyReceiver.java`) for unbreakable background processing.
* **Offline Sync Engine:** Custom queue-based sync utilizing `@capacitor/network`.

---

## 📸 Screenshots
<p align="center">
  <img src="./screenshots/medixiq dasboard.jpeg" alt="Dashboard" width="200" />
  <img src="./screenshots/medixiq med list.jpeg" alt="medicine management" width="200" />
  <img src="./screenshots/medixiq ai start.jpeg" alt="AI Feature" width="200"/>
  <img src="./screenshots/medixai history.jpeg" alt="Log History" width="200" />
  <img src="./screenshots/medixiq presciption.jpeg" alt="Prescription Storage" width="200" />
  <img src="./screenshots/medixiq tracking.jpeg" alt="Med & Health Tracking" width="200" />
  <img src="./screenshots/medixiq emergency alert.jpeg" alt="Accident Detection" width="200" />
</p>

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* Android Studio (for mobile emulation/building)
* MongoDB database

### Installation

1. **Clone the repository**
   ```bash
   git clone [https://github.com/yourusername/MedMind.git](https://github.com/yourusername/MedMind.git)
   cd MedMind


   Backend Setup

Bash
cd backend
npm install
# Configure your .env file with MongoDB URI, JWT Secret, and AI API keys
npm run start
Frontend / Mobile Setup

Bash
cd ../frontend
npm install
# Configure your .env file with API_BASE_URL pointing to your backend
Build and Run on Android Device
Ensure your Android device is connected via USB and USB Debugging is enabled.

Bash
npm run build
npx cap sync android
npx cap run android
Note: For Xiaomi/HyperOS users, ensure MIUI optimizations are handled properly for background services.
