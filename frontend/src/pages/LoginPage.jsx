import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  ShieldCheck, 
  User, 
  Lock, 
  ArrowRight, 
  Globe, 
  Sparkles, 
  AlertCircle,
  HelpCircle,
  UserPlus
} from 'lucide-react';
import { LANGUAGES, TRANSLATIONS } from '../i18n';
import { apiRequest } from '../api';
import { loginUser, isSupabaseConfigured } from '../supabaseClient';

const ROTATING_TAGLINES = [
  "Justice, Understood Faster.",
  "Every Grievance Has a Voice in Any Language.",
  "Real-Time Multilingual NLP & Urgency Prioritization.",
  "Explainable AI for Police, Tribunals, and Citizens."
];

export default function LoginPage({ onLoginSuccess, onNavigateToRegister, currentLang, setCurrentLang }) {
  // Empty default credentials - NO prefilled credentials or autofill
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Forgot password OTP modal
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpStep, setOtpStep] = useState(1); // 1: send, 2: verify
  const [otpNotice, setOtpNotice] = useState('');

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS['en'];

  useEffect(() => {
    const timer = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % ROTATING_TAGLINES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      let loggedInUser = null;

      // 1. Authenticate via backend API (cross-checks SQLite and Supabase Auth with auto-sync)
      const data = await apiRequest('/auth/login', 'POST', {
        email: email.trim(),
        password,
      });

      localStorage.setItem('legal_jwt_token', data.access_token);
      loggedInUser = data.user;

      // 2. Also establish direct Supabase client session if Supabase is configured
      if (isSupabaseConfigured) {
        try {
          const supaRes = await loginUser({ email: email.trim(), password });
          if (supaRes?.user) {
            loggedInUser = { ...loggedInUser, ...supaRes.user };
          }
        } catch (supaErr) {
          console.warn("Supabase Auth session sync note:", supaErr.message);
        }
      }

      // Store authenticated session
      localStorage.setItem('legal_user', JSON.stringify(loggedInUser));

      // Role-aware redirect executed by parent handler
      onLoginSuccess(loggedInUser);
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!otpEmail) return;
    try {
      const res = await apiRequest(`/auth/forgot-password/send-otp?email=${encodeURIComponent(otpEmail.trim())}`, 'POST');
      setOtpStep(2);
      setOtpNotice(`Verification OTP generated and sent to ${otpEmail.trim()}. Code: ${res.mock_otp || 'Check Email'}`);
    } catch (e) {
      setOtpNotice(e.message || "Failed to send reset code.");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || !newPassword) return;
    try {
      const res = await apiRequest(
        `/auth/forgot-password/verify-otp?email=${encodeURIComponent(otpEmail.trim())}&otp=${encodeURIComponent(otpCode.trim())}&new_password=${encodeURIComponent(newPassword)}`,
        'POST'
      );
      alert(res.message);
      setShowOtpModal(false);
      setPassword(newPassword);
    } catch (e) {
      setOtpNotice(e.message || "Verification failed.");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-900 text-slate-100 overflow-hidden">
      
      {/* LEFT COLUMN: Animated Visual Hero & Project Mission */}
      <div className="relative lg:w-1/2 flex flex-col justify-between p-8 sm:p-14 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border-b lg:border-b-0 lg:border-r border-slate-800">
        
        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-white">LexiPulse AI</h1>
              <p className="text-xs text-sky-400 font-medium">B.Tech Capstone Project</p>
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <select
              value={currentLang}
              onChange={(e) => setCurrentLang(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                  {l.flag} {l.native}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center Tagline Transition */}
        <div className="relative z-10 my-12 lg:my-0 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-300 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-spin-slow" />
            Multilingual Neural Legal Classification
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight min-h-[120px] transition-all">
            {ROTATING_TAGLINES[taglineIndex]}
          </h2>

          <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed">
            Automated emotion scoring (7 affective classes), 4-tier urgency triage, 
            explainable AI justification, and SLA auto-routing for Indian police and judicial forums.
          </p>

          {/* Realtime Supabase Persistence Badge */}
          <div className="mt-8 p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-white block">Supabase Enterprise Persistence</span>
              <span className="text-slate-400 text-[11px]">
                Role-based Row Level Security (RLS) & live subscription streaming enabled.
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Institutional Disclaimer */}
        <div className="relative z-10 text-xs text-slate-500">
          Academic Project Demonstration • Department of Computer Science & Engineering
        </div>

      </div>

      {/* RIGHT COLUMN: Clean Single-Sign-On Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        
        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-800/70 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10">
          
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white tracking-tight">{t.loginTitle}</h3>
            <p className="text-xs text-slate-400 mt-1.5">{t.loginSubtitle}</p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 mb-6 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Single Universal Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Official Identifier / Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs bg-slate-900/90 text-white border border-slate-700 rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                  autoComplete="email"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowOtpModal(true)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors font-medium cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs bg-slate-900/90 text-white border border-slate-700 rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                  autoComplete="current-password"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Sign In Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-lg shadow-sky-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>Authenticating with Supabase...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Registration Navigation Link */}
          <div className="mt-8 pt-6 border-t border-slate-700/80 text-center">
            <p className="text-xs text-slate-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="text-sky-400 hover:text-sky-300 font-bold transition-colors ml-1 cursor-pointer inline-flex items-center gap-1"
              >
                <span>Register</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </p>
          </div>

        </div>

      </div>

      {/* Forgot Password OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h4 className="font-bold text-white text-base mb-1.5">Reset Password via OTP</h4>
            <p className="text-xs text-slate-400 mb-4">
              Enter registered email to receive verification code.
            </p>

            {otpNotice && (
              <div className="p-2.5 mb-3 rounded-xl bg-sky-950 border border-sky-800 text-sky-300 text-xs">
                {otpNotice}
              </div>
            )}

            {otpStep === 1 ? (
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none"
                />
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setShowOtpModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendOtp}
                    className="px-4 py-1.5 text-xs bg-sky-600 hover:bg-sky-500 font-bold text-white rounded-xl cursor-pointer"
                  >
                    Send OTP
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none font-mono"
                />
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none"
                />
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setShowOtpModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerifyOtp}
                    className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-xl cursor-pointer"
                  >
                    Verify & Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
