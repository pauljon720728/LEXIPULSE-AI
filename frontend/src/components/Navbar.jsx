import React, { useState, useRef, useEffect } from 'react';
import { 
  Scale, 
  Globe, 
  Moon, 
  Sun, 
  Cpu, 
  ShieldAlert, 
  FileText, 
  BarChart3, 
  CheckSquare, 
  Settings, 
  LogOut, 
  UserCircle,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { LANGUAGES, TRANSLATIONS } from '../i18n';

export default function Navbar({ 
  user, 
  activeTab, 
  setActiveTab, 
  currentLang, 
  setCurrentLang, 
  darkMode, 
  setDarkMode, 
  onLogout,
  modelMode = "transformer",
  ollamaOnline = false
}) {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS['en'];
  const isOfficerOrAdmin = user && ['officer', 'admin', 'super_admin'].includes(user.role);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-900/95 dark:bg-slate-950/95 border-b border-slate-800 text-slate-100 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Name */}
        <div 
          className="flex items-center gap-3 cursor-pointer shrink-0 group select-none py-1"
          onClick={() => setActiveTab(isOfficerOrAdmin ? 'dashboard' : 'submit')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25 text-white ring-1 ring-white/20 transition-transform group-hover:scale-105">
            <Scale className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                LexiPulse<span className="text-sky-400">AI</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-950/90 text-sky-300 border border-sky-800/80 whitespace-nowrap">
                B.Tech Capstone
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
              Legal Grievance & Emotion Triage System
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/80 text-xs font-semibold shadow-inner">
            {isOfficerOrAdmin && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{t.navGrievances}</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('submit')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'submit'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t.navSubmit}</span>
            </button>

            {isOfficerOrAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    activeTab === 'analytics'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>{t.navAnalytics}</span>
                </button>

                <button
                  onClick={() => setActiveTab('evaluation')}
                  className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    activeTab === 'evaluation'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{t.navEvaluation}</span>
                </button>

                {['admin', 'super_admin'].includes(user?.role) && (
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                      activeTab === 'settings'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                        : 'text-amber-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold">Admin Control Panel</span>
                  </button>
                )}
              </>
            )}
          </nav>
        )}

        {/* Right Controls: Model Mode Badge, Language, Theme, User Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          
          {/* Active Model Indicator Pill */}
          <div 
            className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 border border-slate-700/80 text-slate-200 shadow-sm"
            title={modelMode === 'llm' ? (ollamaOnline ? "Ollama Llama 3.1 Active & Online" : "Ollama Daemon Offline (Transformer Fallback Active)") : "Transformer Pipeline Active (100% Offline Ready)"}
          >
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Mode:</span>
            <span className="font-bold text-sky-300 capitalize">
              {modelMode}
            </span>
            <span 
              className={`w-2 h-2 rounded-full ${
                modelMode === 'llm' 
                  ? (ollamaOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400') 
                  : 'bg-emerald-400'
              }`} 
            />
          </div>

          {/* Unified Profile & Settings Dropdown Button (User, Language, Brightness, Logout) */}
          <div className="relative" ref={menuRef}>
            <button
              id="unified-settings-menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              className={`flex items-center gap-2.5 py-1.5 px-3 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                menuOpen
                  ? 'bg-slate-800 border-sky-500 ring-2 ring-sky-500/20 text-white'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/80 hover:border-slate-600 text-slate-200'
              }`}
              title="User Profile, Language, Brightness & Session Controls"
            >
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white text-xs font-extrabold flex items-center justify-center shadow-inner">
                {getInitials(user?.full_name)}
              </div>
              <div className="text-left leading-tight">
                <p className="text-xs font-bold text-white truncate max-w-[120px]">
                  {user?.full_name || 'Guest User'}
                </p>
                <span className="text-[10px] font-extrabold text-sky-400 uppercase tracking-wider block">
                  {user?.role || 'Citizen'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${menuOpen ? 'rotate-180 text-sky-400' : ''}`} />
            </button>

            {/* Dropdown Menu Overlay */}
            {menuOpen && (
              <div className="absolute right-0 mt-2.5 w-76 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-slate-700/90 shadow-2xl z-50 p-3 text-slate-200 animate-in fade-in slide-in-from-top-2">
                
                {/* 1. User Profile Dossier Header */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 mb-2.5 shadow-inner">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white text-sm font-extrabold flex items-center justify-center shadow-md shrink-0">
                    {getInitials(user?.full_name)}
                  </div>
                  <div className="overflow-hidden min-w-0">
                    <p className="font-extrabold text-sm text-white truncate">
                      {user?.full_name || 'Anonymous User'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate font-mono">
                      {user?.email || 'portal@grievance.gov.in'}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {user?.role || 'Citizen'}
                      </span>
                      {user?.department_name && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold truncate max-w-[130px] bg-slate-700/60 text-slate-300">
                          {user.department_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 py-1">
                  
                  {/* 2. Language Selector */}
                  <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/40 space-y-1.5">
                    <label className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span className="flex items-center gap-1.5 text-sky-400">
                        <Globe className="w-3.5 h-3.5" />
                        Language / भाषा / భాష
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">
                        {currentLang}
                      </span>
                    </label>
                    <div className="relative">
                      <select
                        value={currentLang}
                        onChange={(e) => setCurrentLang(e.target.value)}
                        className="w-full bg-slate-800 text-slate-100 text-xs font-semibold py-2 px-3 rounded-xl border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer transition-colors shadow-sm"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                            {l.flag} {l.native} ({l.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 3. Brightness / Theme Toggle */}
                  <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      {darkMode ? (
                        <Moon className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-400" />
                      )}
                      <span>Brightness & Theme</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDarkMode(!darkMode)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                        darkMode
                          ? 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700'
                          : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                      }`}
                      title="Toggle Dark / Light Theme"
                    >
                      {darkMode ? <Moon className="w-3 h-3 text-sky-400" /> : <Sun className="w-3 h-3 text-amber-500" />}
                      <span>{darkMode ? "Dark Mode" : "Light Mode"}</span>
                    </button>
                  </div>

                </div>

                {/* 4. Logout Action Button */}
                <div className="pt-2 border-t border-slate-800/80 mt-2">
                  <button
                    id="logout-button"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-600 border border-rose-800/60 hover:border-rose-500 rounded-xl transition-all shadow-sm cursor-pointer"
                    title="Terminate current session and sign out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out / Logout</span>
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
}
