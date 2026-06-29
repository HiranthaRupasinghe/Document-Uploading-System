import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { ForgotPassword } from './components/ForgotPassword';
import { Dashboard } from './components/Dashboard';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('login');

  useEffect(() => {
    if (!loading) {
      if (user) {
        setCurrentView('dashboard');
      } else if (currentView === 'dashboard') {
        setCurrentView('login');
      }
    }
  }, [user, loading, currentView]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)',
        color: '#f8fafc',
        fontFamily: 'sans-serif'
      }}>
        <h2>Loading secure context...</h2>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'signup':
        return <Signup onNavigate={setCurrentView} />;
      case 'forgot-password':
        return <ForgotPassword onNavigate={setCurrentView} />;
      case 'dashboard':
        return user ? <Dashboard /> : <Login onNavigate={setCurrentView} />;
      case 'login':
      default:
        return <Login onNavigate={setCurrentView} />;
    }
  };

  return <>{renderView()}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
