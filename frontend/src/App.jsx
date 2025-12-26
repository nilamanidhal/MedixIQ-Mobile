import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

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
