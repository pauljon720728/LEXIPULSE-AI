import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import EscalationAlertBanner from './components/EscalationAlertBanner';
import AssistantWidget from './components/AssistantWidget';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CitizenPortal from './pages/CitizenPortal';
import OfficerDashboard from './pages/OfficerDashboard';
import AnalyticsPage from './pages/AnalyticsPage';
import EvaluationPage from './pages/EvaluationPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import { apiRequest } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [activeTab, setActiveTab] = useState('submit'); // 'dashboard' | 'submit' | 'analytics' | 'evaluation' | 'settings'
  const [darkMode, setDarkMode] = useState(true);
  const [currentLang, setCurrentLang] = useState('en');
  const [modelMode, setModelMode] = useState('transformer');
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [criticalAlert, setCriticalAlert] = useState(null);

  // Restore user session or start with guest
  useEffect(() => {
    const savedUser = localStorage.getItem('legal_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        if (['admin', 'super_admin'].includes(u.role)) {
          setActiveTab('settings');
        } else if (u.role === 'officer') {
          setActiveTab('dashboard');
        } else {
          setActiveTab('submit');
        }
      } catch (e) {
        localStorage.removeItem('legal_user');
      }
    }

    // Check Ollama health
    apiRequest('/admin/llm-health')
      .then(res => setOllamaOnline(res?.status === 'online'))
      .catch(() => setOllamaOnline(false));

    // Check system settings
    apiRequest('/admin/settings')
      .then(settings => {
        if (settings?.model_mode) setModelMode(settings.model_mode);
      })
      .catch(() => {});
  }, []);

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    // Role-aware redirect:
    if (['admin', 'super_admin'].includes(loggedInUser.role)) {
      setActiveTab('settings');
    } else if (loggedInUser.role === 'officer') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('submit');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('legal_jwt_token');
    localStorage.removeItem('legal_user');
    setUser(null);
    setAuthMode('login');
    setActiveTab('submit');
  };

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* If not logged in, show Login or Register Page */}
      {!user ? (
        authMode === 'register' ? (
          <RegisterPage
            onNavigateToLogin={() => setAuthMode('login')}
            currentLang={currentLang}
            setCurrentLang={setCurrentLang}
          />
        ) : (
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onNavigateToRegister={() => setAuthMode('register')}
            currentLang={currentLang}
            setCurrentLang={setCurrentLang}
          />
        )
      ) : (
        <>
          {/* Top Navbar */}
          <Navbar
            user={user}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentLang={currentLang}
            setCurrentLang={setCurrentLang}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            onLogout={handleLogout}
            modelMode={modelMode}
            ollamaOnline={ollamaOnline}
          />

          {/* Critical Escalation Alert Toast / Banner */}
          <EscalationAlertBanner
            criticalComplaint={criticalAlert}
            onDismiss={() => setCriticalAlert(null)}
            onViewDetail={(id) => {
              setActiveTab('dashboard');
              setCriticalAlert(null);
            }}
          />

          {/* Main View Render */}
          <main className="flex-1 transition-colors">
            {activeTab === 'dashboard' && (
              <OfficerDashboard
                user={user}
                onCriticalEscalation={(c) => setCriticalAlert(c)}
              />
            )}

            {activeTab === 'submit' && (
              <CitizenPortal
                user={user}
                currentLang={currentLang}
                onComplaintSubmitted={(res) => {
                  if (res?.urgency_label === 'Critical') {
                    setCriticalAlert({
                      id: res.complaint_id,
                      category: res.category,
                      urgency: res.urgency_label
                    });
                  }
                }}
              />
            )}

            {activeTab === 'analytics' && <AnalyticsPage />}

            {activeTab === 'evaluation' && <EvaluationPage />}

            {activeTab === 'settings' && (
              <AdminSettingsPage
                currentModelMode={modelMode}
                onModelModeChanged={(newMode) => setModelMode(newMode)}
              />
            )}
          </main>

          {/* Floating AI Assistant Widget */}
          <AssistantWidget
            userRole={user.role}
            onSelectComplaint={(id) => {
              setActiveTab('dashboard');
            }}
          />

          {/* Footer */}
          <footer className="py-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
            <p>
              NLP-Based Legal Complaint Emotion & Urgency Classification System • Final-Year B.Tech Capstone Project
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              FastAPI • React & TailwindCSS • Llama 3.1 & DistilRoBERTa • ReportLab PDF Engine
            </p>
          </footer>
        </>
      )}

    </div>
  );
}
