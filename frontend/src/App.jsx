import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { App as CapacitorApp } from '@capacitor/app';

// Layout & Components
import MobileLayout from './components/MobileLayout';
import LoadingSpinner from './components/LoadingSpinner';
import AuthPage from './components/AuthPage'; // or './pages/AuthPage' (Check your path!)

// Pages
import Dashboard from './components/Dashboard'; // or './pages/Dashboard'
import ActiveMedicines from './components/pages/ActiveMedicines';
import Reminders from './components/pages/Reminders';
import HistorySection from './components/pages/HistorySection';
import HealthTracking from './components/pages/HealthTraking';
import ContactPage from './components/pages/ContactPage';
import MorePage from './components/pages/MorePage';
import MedicalRecords from './components/pages/MedicalRecords';


// 🟢 1. Create a Helper Component to Handle Back Button
const BackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleBackButton = async () => {
      const currentPath = location.pathname;

      // 1. Define Explicit "Parent" Paths
      // (If I am on Key, go to Value)
      const parentRoutes = {
        '/history': '/more',           // History -> More
        '/medical-records': '/more',   // Prescriptions -> More
        '/contact': '/more',           // Contact -> More
        '/more': '/dashboard',         // More -> Dashboard
        '/health-tracking': '/dashboard', // Health -> Dashboard
        '/add-medicine': '/dashboard', // Add Med -> Dashboard
      };

      // 2. Define Exit Routes (Where the App Closes)
      const exitRoutes = ['/', '/login', '/dashboard'];

      if (exitRoutes.includes(currentPath)) {
        // Exit App
        CapacitorApp.exitApp();
      } else if (parentRoutes[currentPath]) {
        // Go to specific parent (Enforces your hierarchy)
        navigate(parentRoutes[currentPath]);
      } else {
        // Default: Go back one step
        navigate(-1);
      }
    };

    const listener = CapacitorApp.addListener('backButton', handleBackButton);

    return () => {
      listener.then(handler => handler.remove());
    };
  }, [navigate, location]);

  return null;
};

// --- 🔒 Protected Route (For App Pages) ---
// If NOT logged in -> Go to Login
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner text="Loading..." />;
  if (!user) return <Navigate to="/login" replace />;

  return children;
};

// --- 🔓 Public Route (For Login Page) ---
// If ALREADY logged in -> Go to Dashboard
// (This fixes your issue!)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner text="Checking session..." />;
  if (user) return <Navigate to="/dashboard" replace />;

  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>

      {/* ✅ PLACE IT HERE: Inside Router, Outside Routes */}
        <BackButtonHandler />

        <Routes>
          
          {/* 🔥 WRAP LOGIN IN PUBLIC ROUTE */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            } 
          />

          {/* Protected App Routes */}
          <Route 
            element={
              <ProtectedRoute>
                <MobileLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/active-medicines" element={<ActiveMedicines />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/history" element={<HistorySection />} />
            <Route path="/health-tracking" element={<HealthTracking />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/medical-records" element={<MedicalRecords />} />
            <Route path="/more" element={<MorePage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;









// import React from 'react';
// import { AuthProvider, useAuth } from './contexts/AuthContext';
// import AuthPage from './components/AuthPage';
// import Dashboard from './components/Dashboard';
// import Navbar from './components/Navbar';
// import LoadingSpinner from './components/LoadingSpinner';
// import AiChatbot from './components/AiChatbot';

// const AppContent = () => {
//   const { user, loading } = useAuth();

//   if (loading) {
//     return <LoadingSpinner text="Loading MediMind..." />;
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {user ? (
//         <>
//           <Navbar />
//           <Dashboard />
//           <AiChatbot/>
//         </>
//       ) : (
//         <AuthPage />
//       )}
//     </div>
//   );
// };

// function App() {
//   return (
//     <AuthProvider>
//       <AppContent />
//     </AuthProvider>
//   );
// }

// export default App;
