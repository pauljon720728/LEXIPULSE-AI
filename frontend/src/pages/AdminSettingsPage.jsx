import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Cpu, 
  Sparkles, 
  Download, 
  ShieldCheck, 
  Layers, 
  Users, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Plus,
  Globe,
  BookOpen,
  Code2,
  Trash2,
  UserCheck,
  UserX,
  History,
  Shield,
  Search,
  Key,
  Filter,
  Eye,
  X,
  ArrowUpRight,
  UserPlus
} from 'lucide-react';
import { apiRequest, exportCsvUrl } from '../api';
import { LANGUAGES } from '../i18n';
import { 
  fetchAllUsersFromSupabase, 
  updateUserRoleInSupabase, 
  toggleUserActiveStatusInSupabase, 
  fetchUserAuditLogsFromSupabase,
  isSupabaseConfigured 
} from '../supabaseClient';

export default function AdminSettingsPage({ currentModelMode, onModelModeChanged }) {
  // Navigation tabs inside Admin Control Panel
  const [activeAdminTab, setActiveAdminTab] = useState('users'); // 'users' | 'departments' | 'models' | 'languages' | 'export'

  // User Management State
  const [usersList, setUsersList] = useState([]);
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // User Activity Drawer / Modal
  const [selectedUserActivity, setSelectedUserActivity] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Promote User Modal
  const [promoteModalUser, setPromoteModalUser] = useState(null);
  const [promoteDeptId, setPromoteDeptId] = useState('');
  const [promoteTargetRole, setPromoteTargetRole] = useState('officer');

  // Create Staff Account Modal
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('OfficerPass2026!');
  const [staffRole, setStaffRole] = useState('officer');
  const [staffDeptId, setStaffDeptId] = useState('');
  const [staffLang, setStaffLang] = useState('en');
  const [creatingStaff, setCreatingStaff] = useState(false);

  // Existing settings states
  const [departments, setDepartments] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [activeMode, setActiveMode] = useState(currentModelMode || 'transformer');
  const [llmHealth, setLlmHealth] = useState(null);
  const [langConfig, setLangConfig] = useState({ curated_languages: [], few_shot_examples: [] });
  const [loading, setLoading] = useState(true);
  const [updatingMode, setUpdatingMode] = useState(false);
  const [notice, setNotice] = useState('');

  // Add department modal state
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptFocus, setNewDeptFocus] = useState('');

  // Load All Users
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      let users = null;
      if (isSupabaseConfigured) {
        try {
          users = await fetchAllUsersFromSupabase();
        } catch (e) {
          console.warn("Supabase users fetch failed, falling back to API:", e);
        }
      }

      if (!users || users.length === 0) {
        const query = userRoleFilter !== 'all' ? `?role=${userRoleFilter}` : '';
        users = await apiRequest(`/admin/users${query}`);
      }

      setUsersList(users || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load General Admin Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [deptRes, offRes, healthRes, langRes] = await Promise.all([
        apiRequest('/admin/departments'),
        apiRequest('/admin/officers'),
        apiRequest('/admin/llm-health'),
        apiRequest('/admin/languages-config').catch(() => ({ curated_languages: [], few_shot_examples: [] }))
      ]);
      setDepartments(deptRes || []);
      setOfficers(offRes || []);
      setLlmHealth(healthRes || {});
      setLangConfig(langRes || { curated_languages: [], few_shot_examples: [] });
    } catch (e) {
      console.error("Admin data load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadUsers();
  }, [userRoleFilter]);

  // Promote Citizen to Officer
  const handlePromoteUser = async (e) => {
    e.preventDefault();
    if (!promoteModalUser) return;
    try {
      if (isSupabaseConfigured) {
        await updateUserRoleInSupabase(
          promoteModalUser.id, 
          promoteTargetRole, 
          promoteDeptId ? parseInt(promoteDeptId) : null
        ).catch(e => console.warn("Supabase direct role sync:", e));
      }

      await apiRequest(`/admin/users/${promoteModalUser.id}/role`, 'PATCH', {
        role: promoteTargetRole,
        department_id: promoteDeptId ? parseInt(promoteDeptId) : null
      });

      setPromoteModalUser(null);
      setNotice(`User ${promoteModalUser.name || promoteModalUser.full_name} promoted to ${promoteTargetRole.toUpperCase()}!`);
      setTimeout(() => setNotice(''), 4000);
      loadUsers();
    } catch (err) {
      alert(`Promotion failed: ${err.message}`);
    }
  };

  // Toggle user active / suspended
  const handleToggleStatus = async (userObj) => {
    const newStatus = !userObj.is_active;
    const confirmMsg = newStatus 
      ? `Reactivate account for ${userObj.email}?` 
      : `Suspend account for ${userObj.email}? They will be blocked from logging in.`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      if (isSupabaseConfigured) {
        await toggleUserActiveStatusInSupabase(userObj.id, newStatus).catch(e => console.warn(e));
      }
      await apiRequest(`/admin/users/${userObj.id}/status`, 'PATCH', { is_active: newStatus });
      setNotice(`Account ${userObj.email} is now ${newStatus ? 'ACTIVE' : 'SUSPENDED'}.`);
      setTimeout(() => setNotice(''), 4000);
      loadUsers();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  // Delete User
  const handleDeleteUser = async (userObj) => {
    if (!window.confirm(`Permanently delete user ${userObj.email}? This cannot be undone.`)) return;
    try {
      await apiRequest(`/admin/users/${userObj.id}`, 'DELETE');
      setNotice(`User ${userObj.email} deleted.`);
      setTimeout(() => setNotice(''), 4000);
      loadUsers();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // View user activity
  const handleViewActivity = async (userObj) => {
    setSelectedUserActivity(userObj);
    setLoadingActivity(true);
    try {
      let logs = null;
      if (isSupabaseConfigured) {
        try {
          logs = await fetchUserAuditLogsFromSupabase(userObj.id);
        } catch (e) {
          console.warn("Supabase audit log fetch failed:", e);
        }
      }
      if (!logs || logs.length === 0) {
        logs = await apiRequest(`/admin/users/${userObj.id}/activity`).catch(() => []);
      }
      setActivityLogs(logs || []);
    } catch (err) {
      console.error("Could not fetch user activity:", err);
      setActivityLogs([]);
    } finally {
      setLoadingActivity(false);
    }
  };

  // Create Staff Account
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setCreatingStaff(true);
    try {
      await apiRequest('/admin/users/create', 'POST', {
        name: staffName,
        email: staffEmail,
        password: staffPassword,
        role: staffRole,
        department_id: staffDeptId ? parseInt(staffDeptId) : null,
        language_pref: staffLang
      });
      setShowCreateStaffModal(false);
      setStaffName('');
      setStaffEmail('');
      setNotice(`Staff account ${staffEmail} (${staffRole}) created successfully!`);
      setTimeout(() => setNotice(''), 4000);
      loadUsers();
    } catch (err) {
      alert(`Could not create staff user: ${err.message}`);
    } finally {
      setCreatingStaff(false);
    }
  };

  // Toggle model engine
  const handleToggleMode = async (mode) => {
    setUpdatingMode(true);
    try {
      await apiRequest(`/admin/settings/toggle-model?mode=${mode}`, 'POST');
      setActiveMode(mode);
      if (onModelModeChanged) onModelModeChanged(mode);
      setNotice(`Engine successfully switched to ${mode.toUpperCase()} mode.`);
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      alert(`Could not toggle model mode: ${err.message}`);
    } finally {
      setUpdatingMode(false);
    }
  };

  // Add department
  const handleAddDept = async (e) => {
    e.preventDefault();
    if (!newDeptName || !newDeptCode) return;
    try {
      await apiRequest('/admin/departments', 'POST', {
        name: newDeptName,
        code: newDeptCode,
        category_focus: newDeptFocus || 'General Grievance'
      });
      setShowAddDept(false);
      setNewDeptName('');
      setNewDeptCode('');
      setNewDeptFocus('');
      loadData();
      setNotice(`Department '${newDeptName}' added successfully.`);
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      alert(`Could not create department: ${err.message}`);
    }
  };

  // Filtered users
  const filteredUsers = usersList.filter(u => {
    const q = userSearchQuery.toLowerCase();
    const matchesSearch = !q || 
      (u.name || u.full_name || '').toLowerCase().includes(q) || 
      (u.email || '').toLowerCase().includes(q);
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      
      {/* DISTINCT ADMIN COMMAND HEADER: Royal Indigo & Amber Theme */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border-b border-indigo-900/60 shadow-xl py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-amber-500 flex items-center justify-center shadow-xl shadow-indigo-500/25 ring-2 ring-indigo-400/30">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Admin Control Panel
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-extrabold uppercase tracking-wider">
                    Superuser Tier
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  System governance, role-based user management, multilingual neural pipelines, and Supabase database persistence.
                </p>
              </div>
            </div>

            {/* Quick System Status Badges */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-indigo-800/80 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300 font-semibold">Supabase RLS:</span>
                <span className="text-emerald-400 font-bold">Active</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-indigo-800/80 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300 font-semibold">NLP Engine:</span>
                <span className="text-amber-400 font-bold uppercase">{activeMode}</span>
              </div>
            </div>
          </div>

          {/* Notice Alert */}
          {notice && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2 shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Navigation Sub-Tabs */}
          <div className="flex flex-wrap items-center gap-2 mt-8 pt-4 border-t border-indigo-900/50">
            <button
              onClick={() => setActiveAdminTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeAdminTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400'
                  : 'bg-slate-900/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>User Management</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-300">
                {usersList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveAdminTab('departments')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeAdminTab === 'departments'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400'
                  : 'bg-slate-900/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Departments & Routing</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-300">
                {departments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveAdminTab('models')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeAdminTab === 'models'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400'
                  : 'bg-slate-900/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Classification Engine Mode</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('languages')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeAdminTab === 'languages'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400'
                  : 'bg-slate-900/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Multilingual & Few-Shot</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('export')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeAdminTab === 'export'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400'
                  : 'bg-slate-900/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Archiving & CSV Export</span>
            </button>
          </div>

        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ============================================================== */}
        {/* TAB 1: USER MANAGEMENT (Full CRUD, Promotion, Suspension) */}
        {/* ============================================================== */}
        {activeAdminTab === 'users' && (
          <div className="space-y-6">
            
            {/* Toolbar */}
            <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
              
              {/* Search */}
              <div className="flex-1 min-w-[260px] relative">
                <input
                  type="text"
                  placeholder="Search accounts by name or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white rounded-xl pl-9 pr-4 py-2.5 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>

              {/* Role Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold">
                {['all', 'citizen', 'officer', 'admin'].map((roleKey) => (
                  <button
                    key={roleKey}
                    onClick={() => setUserRoleFilter(roleKey)}
                    className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                      userRoleFilter === roleKey
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {roleKey}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={loadUsers}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  title="Refresh users"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={() => setShowCreateStaffModal(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-bold text-xs text-white shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create Staff Account</span>
                </button>
              </div>

            </div>

            {/* Users Table */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/90 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4">Language</th>
                      <th className="py-3.5 px-4">Registered Date</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                          <span>Loading users from Supabase...</span>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          No registered user accounts match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const userName = u.name || u.full_name || 'Anonymous';
                        const isSuspended = u.is_active === false;
                        return (
                          <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                            {/* User & Email */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                                  {userName.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-white block">{userName}</span>
                                  <span className="text-slate-400 text-[11px] font-mono">{u.email}</span>
                                </div>
                              </div>
                            </td>

                            {/* Role */}
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide border ${
                                u.role === 'admin' || u.role === 'super_admin'
                                  ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                                  : u.role === 'officer'
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                  : 'bg-sky-950/80 text-sky-300 border-sky-800'
                              }`}>
                                {u.role}
                              </span>
                            </td>

                            {/* Department */}
                            <td className="py-3.5 px-4 text-slate-300">
                              {u.department_name || (u.departments ? u.departments.name : '—')}
                            </td>

                            {/* Language */}
                            <td className="py-3.5 px-4 text-slate-400 uppercase font-mono text-[11px]">
                              {u.language_pref || 'en'}
                            </td>

                            {/* Registered Date */}
                            <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                !isSuspended
                                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                                  : 'bg-rose-950/60 text-rose-400 border-rose-800'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${!isSuspended ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                {!isSuspended ? 'Active' : 'Suspended'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Activity History */}
                                <button
                                  onClick={() => handleViewActivity(u)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                                  title="View User Activity History"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>

                                {/* Promote Citizen */}
                                {u.role === 'citizen' && (
                                  <button
                                    onClick={() => {
                                      setPromoteModalUser(u);
                                      setPromoteTargetRole('officer');
                                      setPromoteDeptId(departments[0]?.id || '');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 transition-colors text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                    title="Promote to Officer"
                                  >
                                    <ArrowUpRight className="w-3 h-3" />
                                    <span>Promote</span>
                                  </button>
                                )}

                                {/* Suspend / Reactivate */}
                                <button
                                  onClick={() => handleToggleStatus(u)}
                                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                    !isSuspended
                                      ? 'bg-amber-950/60 hover:bg-amber-900 text-amber-300 border-amber-800'
                                      : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                                  }`}
                                  title={!isSuspended ? 'Suspend Account' : 'Reactivate Account'}
                                >
                                  {!isSuspended ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 transition-colors cursor-pointer"
                                  title="Permanently Delete User"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: DEPARTMENTS & ROUTING */}
        {/* ============================================================== */}
        {activeAdminTab === 'departments' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Configured Judicial & Enforcement Departments</h3>
                <p className="text-xs text-slate-400">Manage case routing targets, categories, and assigned officer units.</p>
              </div>
              <button
                onClick={() => setShowAddDept(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Department</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept) => (
                <div key={dept.id} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {dept.code}
                    </span>
                    <span className="text-[11px] text-slate-500">ID #{dept.id}</span>
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">{dept.name}</h4>
                  <p className="text-xs text-slate-400 mb-3">{dept.category_focus}</p>
                  {dept.contact_email && (
                    <div className="text-[11px] text-slate-500 font-mono pt-3 border-t border-slate-800">
                      {dept.contact_email}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: CLASSIFICATION ENGINE MODE */}
        {/* ============================================================== */}
        {activeAdminTab === 'models' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl max-w-2xl">
              <h3 className="text-lg font-bold text-white mb-1">Active NLP Triage Engine</h3>
              <p className="text-xs text-slate-400 mb-6">
                Switch between the high-speed local transformer pipeline and the Ollama local generative model runtime.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <button
                  type="button"
                  disabled={updatingMode}
                  onClick={() => handleToggleMode('transformer')}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
                    activeMode === 'transformer'
                      ? 'bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">Fine-Tuned Transformer</span>
                    <Cpu className="w-4 h-4 text-indigo-400" />
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    DistilRoBERTa + IndicTrans2. High throughput (~20ms latency), 100% offline.
                  </p>
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Recommended for High-Load</span>
                </button>

                <button
                  type="button"
                  disabled={updatingMode}
                  onClick={() => handleToggleMode('llm')}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
                    activeMode === 'llm'
                      ? 'bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">Ollama LLM (llama3.1)</span>
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Generative reasoning with few-shot context and deep explanation synthesis.
                  </p>
                  <span className={`text-[10px] uppercase font-bold ${llmHealth?.status === 'online' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    Ollama: {llmHealth?.status || 'Offline Fallback Active'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: MULTILINGUAL CONFIG */}
        {/* ============================================================== */}
        {activeAdminTab === 'languages' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-1">Supported Regional Languages</h3>
              <p className="text-xs text-slate-400 mb-6">Dynamic tier configuration across IndicTrans2, MarianMT, and NLLB-200 engines.</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {LANGUAGES.map((lang) => (
                  <div key={lang.code} className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-2xl block mb-1">{lang.flag}</span>
                    <span className="font-bold text-white text-xs block">{lang.name}</span>
                    <span className="text-[11px] text-slate-400 block">{lang.native}</span>
                    <span className="text-[10px] font-mono text-indigo-400 mt-1 block">Tier 1 Curated</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: ARCHIVING & CSV EXPORT */}
        {/* ============================================================== */}
        {activeAdminTab === 'export' && (
          <div className="space-y-6">
            <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl max-w-xl">
              <Download className="w-10 h-10 text-indigo-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Export Full Legal Grievance Database</h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Download all intake records, emotion scoring vectors, urgency tiers, translations, and timestamps as an encrypted administrative CSV file.
              </p>
              <a
                href={exportCsvUrl()}
                download="Legal_Complaints_Export.csv"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Complaints CSV</span>
              </a>
            </div>
          </div>
        )}

      </div>

      {/* ============================================================== */}
      {/* MODAL 1: PROMOTE CITIZEN TO OFFICER */}
      {/* ============================================================== */}
      {promoteModalUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-white text-base">Promote Account to Staff</h4>
              <button onClick={() => setPromoteModalUser(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Elevating <strong>{promoteModalUser.name || promoteModalUser.full_name}</strong> ({promoteModalUser.email}).
            </p>

            <form onSubmit={handlePromoteUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Role</label>
                <select
                  value={promoteTargetRole}
                  onChange={(e) => setPromoteTargetRole(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="officer">Officer (Department Investigator)</option>
                  <option value="admin">Administrator (System Supervisor)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Department</label>
                <select
                  value={promoteDeptId}
                  onChange={(e) => setPromoteDeptId(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">None / Unassigned</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setPromoteModalUser(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-xl shadow-md cursor-pointer"
                >
                  Confirm Promotion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: CREATE NEW OFFICER/ADMIN ACCOUNT */}
      {/* ============================================================== */}
      {showCreateStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-white text-base">Create Officer / Admin Account</h4>
              <button onClick={() => setShowCreateStaffModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ACP Rajiv Malhotra"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Official Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="officer@police.gov.in"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Role *</label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value)}
                    className="w-full text-xs bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="officer">Officer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Language</label>
                  <select
                    value={staffLang}
                    onChange={(e) => setStaffLang(e.target.value)}
                    className="w-full text-xs bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Department</label>
                <select
                  value={staffDeptId}
                  onChange={(e) => setStaffDeptId(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">None / Unassigned</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingStaff}
                  className="px-5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {creatingStaff ? 'Creating in Supabase...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: USER ACTIVITY / AUDIT LOG HISTORY */}
      {/* ============================================================== */}
      {selectedUserActivity && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-white text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" />
                  <span>Activity & Audit History</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedUserActivity.name || selectedUserActivity.full_name} ({selectedUserActivity.email})
                </p>
              </div>
              <button onClick={() => setSelectedUserActivity(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingActivity ? (
                <div className="py-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  <span>Loading audit records from Supabase...</span>
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No logged activity records found for this account.
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-indigo-300">{log.action}</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                    {log.complaint_id && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 inline-block mb-1">
                        Case: {log.complaint_id}
                      </span>
                    )}
                    <p className="text-slate-400 text-[11px] mt-1">{log.details}</p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedUserActivity(null)}
                className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: ADD DEPARTMENT */}
      {/* ============================================================== */}
      {showAddDept && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-white text-base">Register New Department</h4>
              <button onClick={() => setShowAddDept(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDept} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Financial Intelligence Unit"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Code / Acronym *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FIU"
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category Focus</label>
                <input
                  type="text"
                  placeholder="e.g. Money Laundering, Hawala"
                  value={newDeptFocus}
                  onChange={(e) => setNewDeptFocus(e.target.value)}
                  className="w-full text-xs bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddDept(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-xl shadow-md cursor-pointer"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
