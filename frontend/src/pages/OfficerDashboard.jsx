import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Download, 
  UserCheck, 
  CheckCircle2, 
  Eye, 
  Sparkles, 
  ExternalLink, 
  Layers, 
  ChevronRight,
  TrendingUp,
  RefreshCw,
  X
} from 'lucide-react';
import { apiRequest, downloadPdfUrl } from '../api';
import complaintService from '../complaintService';

export default function OfficerDashboard({ user, onCriticalEscalation }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [syncState, setSyncState] = useState('synced');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [emotionFilter, setEmotionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);

  // Selected complaint for Detail Inspector Modal
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Resolution modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvedByOfficer, setResolvedByOfficer] = useState('');
  const [resolutionSuccessMsg, setResolutionSuccessMsg] = useState('');

  // Action status update state
  const [actionLoading, setActionLoading] = useState(false);

  // Track sync state
  useEffect(() => {
    const unsubSync = complaintService.onSyncStateChange((s) => setSyncState(s));
    return () => unsubSync();
  }, []);

  // Load complaints list fresh from Supabase via complaintService
  const loadComplaints = async () => {
    setLoading(true);
    try {
      const res = await complaintService.fetchComplaints({
        search: searchQuery,
        urgency: urgencyFilter,
        emotion: emotionFilter,
        category: categoryFilter,
        status: statusFilter,
        departmentId: departmentFilter ? parseInt(departmentFilter) : null,
        page,
        pageSize: 25
      });

      setComplaints(res.items || []);
      setTotalCount(res.total || 0);

      // Check if any Critical complaint is unhandled to trigger escalation banner
      const crit = (res.items || []).find(c => c.urgency_label === 'Critical' && c.status !== 'Resolved');
      if (crit && onCriticalEscalation) {
        onCriticalEscalation(crit);
      }
    } catch (err) {
      console.error("Failed to load complaints from Supabase:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, [page, urgencyFilter, emotionFilter, categoryFilter, statusFilter, departmentFilter]);

  // Realtime Supabase Subscription via complaintService
  useEffect(() => {
    setRealtimeConnected(true);
    const unsubscribe = complaintService.subscribeToChanges({
      onInsert: (newComplaint) => {
        setComplaints(prev => [newComplaint, ...prev.filter(c => c.id !== newComplaint.id)]);
        setTotalCount(prev => prev + 1);
        if (newComplaint.urgency_label === 'Critical' && onCriticalEscalation) {
          onCriticalEscalation(newComplaint);
        }
      },
      onUpdate: (updatedComplaint) => {
        setComplaints(prev => prev.map(c => c.id === updatedComplaint.id ? { ...c, ...updatedComplaint } : c));
        if (selectedComplaintId === updatedComplaint.id) {
          handleOpenDetail(updatedComplaint.id);
        }
      },
      onDelete: (deletedComplaint) => {
        setComplaints(prev => prev.filter(c => c.id !== deletedComplaint.id));
        setTotalCount(prev => Math.max(0, prev - 1));
      }
    });

    return () => {
      unsubscribe();
      setRealtimeConnected(false);
    };
  }, [selectedComplaintId]);

  // Load single complaint detail
  const handleOpenDetail = async (complaintId) => {
    setSelectedComplaintId(complaintId);
    setLoadingDetail(true);
    try {
      const res = await complaintService.getComplaintDetail(complaintId);
      setDetailData(res);
    } catch (err) {
      alert(`Could not fetch details: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Change complaint status via complaintService
  const handleUpdateStatus = async (newStatus, customNotes = '', customResolvedBy = '') => {
    if (!selectedComplaintId) return;
    setActionLoading(true);
    try {
      const finalNote = customNotes || `Status transitioned to ${newStatus} by ${user?.full_name || 'Officer'}`;
      await complaintService.updateStatus(
        selectedComplaintId,
        newStatus,
        user,
        finalNote,
        customNotes,
        customResolvedBy || user?.full_name || 'Officer'
      );

      // Refresh detail and queue
      await handleOpenDetail(selectedComplaintId);
      loadComplaints();
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const openResolveModal = () => {
    setResolvedByOfficer(user?.full_name || 'Inspector Vikram Rathore');
    setResolutionNotes('');
    setResolutionSuccessMsg('');
    setShowResolveModal(true);
  };

  const handleConfirmResolve = async () => {
    if (!resolutionNotes.trim()) {
      alert("Please provide the resolution details explaining how this case was investigated and resolved.");
      return;
    }
    setActionLoading(true);
    try {
      await complaintService.updateStatus(
        selectedComplaintId,
        'Resolved',
        user,
        resolutionNotes,
        resolutionNotes,
        resolvedByOfficer || user?.full_name || 'Authorized Officer'
      );
      setResolutionSuccessMsg("Case officially resolved! Clearance certificate generated.");
      setShowResolveModal(false);
      await handleOpenDetail(selectedComplaintId);
      loadComplaints();
    } catch (err) {
      alert(`Resolution failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getUrgencyBadge = (label) => {
    switch (label) {
      case 'Critical':
        return 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-400 border border-red-300 dark:border-red-800 critical-pulse font-extrabold';
      case 'High':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-950/80 dark:text-orange-400 border border-orange-300 dark:border-orange-800 font-bold';
      case 'Medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-300 dark:border-amber-800 font-medium';
      default:
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 font-medium';
    }
  };

  const getCoverageBadge = (coverage) => {
    switch (coverage?.toUpperCase()) {
      case 'HIGH':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-300 dark:border-amber-800';
      case 'LOW':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Header & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Official Triage & Investigation Queue</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {totalCount} Total Cases
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time multi-department legal dispatch, emotion radar analysis, and SLA tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          {realtimeConnected && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Supabase Realtime Live
            </span>
          )}
          <button
            onClick={() => loadComplaints()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 mb-6 space-y-3">
        
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Search Bar */}
          <div className="flex-1 min-w-[240px] relative">
            <input
              type="text"
              placeholder="Search by ID, text keywords, or complainant name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadComplaints()}
              className="w-full text-xs bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          <button
            onClick={() => loadComplaints()}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow transition-colors"
          >
            Filter
          </button>

        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none"
          >
            <option value="">All Departments</option>
            <option value="1">Cyber Crime Cell</option>
            <option value="2">Women & Child Safety</option>
            <option value="3">Economic Offences Wing</option>
            <option value="4">Revenue & Civil Grievance</option>
            <option value="5">Internal Complaints / POSH</option>
            <option value="6">Consumer Redressal</option>
            <option value="7">Labor Grievance Tribunal</option>
            <option value="8">Anti-Corruption / Vigilance</option>
          </select>

          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none"
          >
            <option value="">All Urgency Levels</option>
            <option value="Critical">Critical (Immediate)</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={emotionFilter}
            onChange={(e) => setEmotionFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none"
          >
            <option value="">All Emotions (7 Classes)</option>
            <option value="fear">Fear</option>
            <option value="distress">Distress</option>
            <option value="anger">Anger</option>
            <option value="desperation">Desperation</option>
            <option value="frustration">Frustration</option>
            <option value="sadness">Sadness</option>
            <option value="neutral">Neutral</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none"
          >
            <option value="">All Legal Categories</option>
            <option value="Cybercrime">Cybercrime</option>
            <option value="Domestic Violence & Abuse">Domestic Violence</option>
            <option value="Financial & Banking Fraud">Financial Fraud</option>
            <option value="Property Dispute">Property Dispute</option>
            <option value="Workplace Harassment">Workplace Harassment</option>
            <option value="Consumer Dispute">Consumer Dispute</option>
            <option value="Labor & Employment Dispute">Labor Dispute</option>
            <option value="Police Negligence & Misconduct">Police Negligence</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="Escalated">Escalated</option>
            <option value="In Investigation">In Investigation</option>
            <option value="Resolved">Resolved</option>
          </select>

        </div>

      </div>

      {/* Main Grievances Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Case ID</th>
                <th className="py-3.5 px-4">Urgency</th>
                <th className="py-3.5 px-4">Emotion</th>
                <th className="py-3.5 px-4">Category & Department</th>
                <th className="py-3.5 px-4">Grievance Summary</th>
                <th className="py-3.5 px-4">Language</th>
                <th className="py-3.5 px-4">Status & SLA</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    Loading judicial complaint records...
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No complaints matching current filter criteria.
                  </td>
                </tr>
              ) : (
                complaints.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenDetail(c.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors"
                  >
                    
                    {/* ID */}
                    <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                      {c.id}
                    </td>

                    {/* Urgency */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] ${getUrgencyBadge(c.urgency_label)}`}>
                        {c.urgency_label} ({c.urgency_score})
                      </span>
                    </td>

                    {/* Emotion */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                        {c.emotion_label}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Conf: {Math.round(c.emotion_confidence * 100)}%
                      </span>
                    </td>

                    {/* Category & Department */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                        {c.category}
                      </div>
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 block truncate max-w-[180px]">
                        {c.department_name}
                      </span>
                    </td>

                    {/* Summary */}
                    <td className="py-3 px-4 max-w-xs">
                      <p className="line-clamp-2 text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                        {c.raw_text}
                      </p>
                    </td>

                    {/* Language & Coverage */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 font-semibold text-slate-800 dark:text-slate-200">
                          {c.detected_lang_name || 'English'}
                        </span>
                        {c.language_coverage_confidence && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold tracking-wider ${getCoverageBadge(c.language_coverage_confidence)}`}>
                            {c.language_coverage_confidence} COV
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status & SLA */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold">{c.status}</div>
                      <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {c.sla_hours}h SLA
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(c.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-sky-50 dark:hover:bg-slate-600 text-sky-600 dark:text-sky-400 font-bold transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>

          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Page {page} • Showing {complaints.length} of {totalCount} records
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={complaints.length < 25}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

      </div>

      {/* DETAIL INSPECTOR MODAL */}
      {selectedComplaintId && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-sky-600 text-white font-mono font-extrabold text-sm">
                  {selectedComplaintId}
                </span>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight flex items-center gap-2">
                    <span>Legal Complaint Intelligence Dossier</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-normal ${
                      syncState === 'saving' 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                        : syncState === 'error'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {syncState === 'saving' ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Saving to Supabase...
                        </>
                      ) : syncState === 'error' ? (
                        <>
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                          Sync Error
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Synced ✓
                        </>
                      )}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Model: {detailData?.complaint?.model_mode_used || 'Fine-Tuned Transformer'} • Live Supabase Realtime Single Source of Truth
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedComplaintId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {loadingDetail ? (
              <div className="p-12 text-center text-slate-500">
                Loading intelligence parameters...
              </div>
            ) : detailData?.complaint ? (
              <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                
                {/* Status & Action Buttons Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Current State:</span>
                    <span className="font-bold text-slate-900 dark:text-white px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600">
                      {detailData.complaint.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${getUrgencyBadge(detailData.complaint.urgency_label)}`}>
                      {detailData.complaint.urgency_label} ({detailData.complaint.urgency_score})
                    </span>

                    {/* Persistence Indicator */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                      syncState === 'saving'
                        ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                        : syncState === 'error'
                        ? 'bg-rose-950/70 text-rose-300 border-rose-800'
                        : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${syncState === 'saving' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                      {syncState === 'saving' ? 'Saving to Supabase...' : syncState === 'error' ? 'Sync Error' : 'Synced ✓'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus('Escalated')}
                      className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-sm transition-colors"
                    >
                      Escalate Priority
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus('In Investigation')}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm transition-colors"
                    >
                      Investigate
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={openResolveModal}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resolve & Issue Clearance
                    </button>
                    <a
                      href={downloadPdfUrl(selectedComplaintId)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Clearance PDF
                    </a>
                  </div>
                </div>

                {/* Resolution Notice & Clearance Certificate Banner */}
                {(detailData.complaint.status === 'Resolved' || detailData.complaint.resolution_notes) && (
                  <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300 text-xs uppercase tracking-wide">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Official Case Clearance & Resolution Certificate</span>
                      </div>
                      {detailData.complaint.resolved_at && (
                        <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                          Cleared at: {new Date(detailData.complaint.resolved_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 text-slate-800 dark:text-slate-100 text-xs leading-relaxed">
                      <span className="block font-bold text-[10px] text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                        Manual Resolution Statement & Action Log:
                      </span>
                      {detailData.complaint.resolution_notes || "Case was thoroughly investigated, verified, and resolved in accordance with standard operating procedure."}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                      <span className="text-slate-600 dark:text-slate-400">
                        Investigating Authority: <strong className="text-slate-900 dark:text-slate-100">{detailData.complaint.resolved_by || user?.full_name || 'Designated Duty Officer'}</strong>
                      </span>
                      <a
                        href={downloadPdfUrl(selectedComplaintId)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Official Signed Clearance PDF
                      </a>
                    </div>
                  </div>
                )}

                {/* Original vs Translated Text Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[11px]">
                        Original Citizen Submission
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold text-[10px]">
                          {detailData.complaint.detected_lang_name} ({Math.round(detailData.complaint.detected_lang_confidence * 100)}%)
                        </span>
                        {detailData.complaint.language_coverage_confidence && (
                          <span 
                            title="Coverage Confidence: Dedicated MT (High), LLM-only (Med), Native reasoning (Low)"
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${getCoverageBadge(detailData.complaint.language_coverage_confidence)}`}
                          >
                            Coverage: {detailData.complaint.language_coverage_confidence}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-sans italic">
                      "{detailData.complaint.raw_text}"
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[11px] block">
                      Standardized Legal English Translation
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-sans font-medium">
                      "{detailData.complaint.translated_text}"
                    </p>
                  </div>
                </div>

                {/* Explainability AI (XAI) Justification Box */}
                <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 space-y-2">
                  <h4 className="font-bold text-sky-900 dark:text-sky-300 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                    <Sparkles className="w-4 h-4 text-sky-500" />
                    Explainable AI (XAI) Algorithmic Justification
                  </h4>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                    {detailData.complaint.explanation_text}
                  </p>
                  {detailData.complaint.trigger_keywords && detailData.complaint.trigger_keywords.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="font-bold text-[10px] text-slate-500 uppercase">Trigger Indicators:</span>
                      {detailData.complaint.trigger_keywords.map((tk, idx) => (
                        <span key={idx} className="font-mono text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-900 font-bold">
                          "{tk}"
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 7-Emotion Affective Spectrum Breakdown */}
                {detailData.complaint.emotion_scores && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                    <span className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[11px] block">
                      Affective Emotion Probability Breakdown (7 Classes)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(detailData.complaint.emotion_scores).map(([emo, score]) => (
                        <div key={emo} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <div className="flex justify-between items-center text-xs capitalize font-semibold mb-1">
                            <span>{emo}</span>
                            <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">
                              {Math.round(score * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                emo === 'fear' || emo === 'distress' ? 'bg-rose-500' :
                                emo === 'anger' ? 'bg-orange-500' :
                                emo === 'desperation' ? 'bg-red-500' : 'bg-sky-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, score * 100))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Similar Past Complaints (Vector Precedent Search) */}
                {detailData.similar_past_complaints && detailData.similar_past_complaints.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[11px] block">
                      Semantic Search Precedents (Vector Cosine Matching)
                    </span>
                    <div className="space-y-2">
                      {detailData.similar_past_complaints.map((sim, sIdx) => (
                        <div key={sIdx} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-xs">
                                {sim.id}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {sim.category}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                {Math.round(sim.similarity_score * 100)}% Semantic Match
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {sim.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit Trail Log */}
                {detailData.audit_logs && detailData.audit_logs.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[11px] block">
                      Audit Trail & Chain of Custody
                    </span>
                    <div className="space-y-1.5">
                      {detailData.audit_logs.map((log) => (
                        <div key={log.id} className="text-xs flex items-center justify-between text-slate-500 py-1 border-b border-slate-200/50 dark:border-slate-800/50">
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 mr-2">{log.action}:</span>
                            <span>{log.details}</span>
                          </div>
                          <span className="font-mono text-[10px]">{log.timestamp.slice(0, 19).replace('T', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : null}

          </div>
        </div>
      )}

      {/* Official Case Resolution & Clearance Statement Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-emerald-500/30 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">Official Case Resolution & Clearance Protocol</h3>
              </div>
              <button 
                onClick={() => setShowResolveModal(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white/90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs">
                Case Reference: <strong className="font-mono text-emerald-800 dark:text-emerald-300">{selectedComplaintId}</strong>
                <span className="mx-2">•</span>
                Citizen: <strong>{detailData?.complaint?.citizen_name || 'Complainant'}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Investigating Officer / Resolution Authority
                </label>
                <input
                  type="text"
                  value={resolvedByOfficer}
                  onChange={(e) => setResolvedByOfficer(e.target.value)}
                  placeholder="Officer Full Name and Designation"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Resolution Statement & Action Log (Mandatory)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  Manually enter the detailed outcome: how the issue was investigated, findings, remedial action taken, and legal redressal granted. This statement will be permanently recorded and displayed on the citizen's portal and official PDF certificate.
                </p>
                <textarea
                  rows={4}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Conducted inquiry with the local branch manager. Disputed transaction was traced to fraudulent merchant gateway and successfully refunded to complainant's savings account. Account security keys refreshed and case closed satisfactorily."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConfirmResolve}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {actionLoading ? 'Issuing Clearance...' : 'Confirm Clearance & Issue Certificate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
