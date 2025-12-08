import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import Navbar from './components/Navbar';
import LoadingSpinner from './components/LoadingSpinner';
import AiChatbot from './components/AiChatbot';

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner text="Loading MediMind..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user ? (
        <>
          <Navbar />
          <Dashboard />
          <AiChatbot/>
        </>
      ) : (
        <AuthPage />
      )}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
