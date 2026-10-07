import React, { useState } from 'react';
import { 
  Scale, 
  User, 
  Mail, 
  Lock, 
  Phone, 
  Globe, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  Info
} from 'lucide-react';
import { LANGUAGES, TRANSLATIONS } from '../i18n';
import { apiRequest } from '../api';
import { registerUser, isSupabaseConfigured } from '../supabaseClient';

export default function RegisterPage({ onNavigateToLogin, currentLang, setCurrentLang }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [languagePref, setLanguagePref] = useState(currentLang || 'en');
  const [selectedRole, setSelectedRole] = useState('citizen');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS['en'];

  // Client-side validations
  const validateForm = () => {
    if (!fullName.trim()) {
      return "Full Name is required.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address.";
    }
    if (password.length < 6) {
      return "Password must be at least 6 characters long.";
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return "Password must contain both letters and numbers.";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }
    return null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setLoading(true);

    try {
      // 1. Try Supabase Auth direct registration if configured
      if (isSupabaseConfigured) {
        await registerUser({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          role: 'citizen',
          languagePref,
          phone: phone.trim()
        });
      }

      // 2. Also register in backend DB to ensure unified cross-system consistency
      await apiRequest('/auth/register', 'POST', {
        email: email.trim(),
        full_name: fullName.trim(),
        password,
        role: 'citizen',
        language_pref: languagePref,
        phone: phone.trim() || undefined
      }).catch(err => {
        // If supabase already handled it and backend reported duplicate, ignore if success
        if (!isSupabaseConfigured) throw err;
      });

      setSuccessMsg("Account successfully registered! Redirecting to login...");
      setTimeout(() => {
        onNavigateToLogin();
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-xl bg-slate-900/85 backdrop-blur-2xl border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10">
        
        {/* Brand & Language Bar */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg tracking-tight text-white">LexiPulse AI</h2>
              <p className="text-xs text-sky-400 font-medium">Citizen Registration Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <select
              value={currentLang}
              onChange={(e) => {
                setCurrentLang(e.target.value);
                setLanguagePref(e.target.value);
              }}
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

        {/* Title */}
        <div className="mb-6">
          <h3 className="text-2xl font-black text-white tracking-tight">Create Citizen Account</h3>
          <p className="text-xs text-slate-400 mt-1">
            Register to file grievances, track status updates live, and receive automated multilingual legal assistance.
          </p>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3.5 mb-5 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 mb-5 rounded-2xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Full Legal Name *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="e.g. Aditi Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full text-xs bg-slate-950/80 text-white border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Email & Phone Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs bg-slate-950/80 text-white border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs bg-slate-950/80 text-white border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Passwords Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters (alphanumeric)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs bg-slate-950/80 text-white border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full text-xs bg-slate-950/80 text-white border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Language Preference */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Preferred Communication Language
            </label>
            <div className="relative">
              <select
                value={languagePref}
                onChange={(e) => setLanguagePref(e.target.value)}
                className="w-full text-xs bg-slate-950/80 text-white border border-slate-700/80 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                    {l.flag} {l.name} ({l.native})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role Selection & Restricted Notice */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Account Role
            </label>
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-950/90 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedRole('citizen')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  selectedRole === 'citizen'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Citizen (Public)
              </button>
              <button
                type="button"
                onClick={() => {
                  alert("Officer accounts are restricted and can only be provisioned by an Administrator in the Admin Control Panel.");
                }}
                className="py-2 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-400 flex items-center justify-center gap-1 cursor-not-allowed opacity-60"
                title="Restricted: Admin created only"
              >
                <span>Officer</span>
                <Lock className="w-3 h-3 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={() => {
                  alert("Administrator accounts cannot be self-registered. They require system elevation.");
                }}
                className="py-2 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-400 flex items-center justify-center gap-1 cursor-not-allowed opacity-60"
                title="Restricted: Super admin elevation only"
              >
                <span>Admin</span>
                <Lock className="w-3 h-3 text-slate-500" />
              </button>
            </div>

            <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-400">
              <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              <span>
                Default role is <strong>Citizen</strong>. Officer and Administrator credentials are strictly provisioned by authorized agency staff via the Admin Control Panel.
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-lg shadow-sky-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Registering Account in Supabase...</span>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Back to Login Link */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-sky-400 hover:text-sky-300 font-bold transition-colors ml-1 cursor-pointer"
            >
              Sign In here
            </button>
          </p>
        </div>

      </div>

    </div>
  );
}
