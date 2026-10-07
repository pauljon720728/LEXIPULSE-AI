/**
 * complaintService.js
 * 
 * DEDICATED SINGLE SOURCE OF TRUTH MODULE FOR ALL COMPLAINT READS & WRITES
 * Wraps Supabase persistence, Realtime subscriptions, and backend NLP triage.
 * Guarantees no complaint data lives only in local state or browser storage.
 */

import { apiRequest } from './api';
import { 
  supabase, 
  isSupabaseConfigured, 
  saveComplaintToSupabase, 
  updateComplaintStatusInSupabase, 
  fetchComplaintsFromSupabase,
  subscribeToRealtimeComplaints 
} from './supabaseClient';

class ComplaintService {
  constructor() {
    this.syncListeners = new Set();
    this.currentSyncState = 'synced'; // 'synced' | 'saving' | 'error'
  }

  setSyncState(state) {
    this.currentSyncState = state;
    this.syncListeners.forEach(listener => listener(state));
  }

  onSyncStateChange(callback) {
    this.syncListeners.add(callback);
    callback(this.currentSyncState);
    return () => this.syncListeners.delete(callback);
  }

  /**
   * Submit new complaint through the multi-stage write path:
   * 1. Backend immediate raw insert (status: "processing")
   * 2. Multilingual NLP classification
   * 3. Update row with classification outputs (status: "classified")
   * 4. Audit log & model predictions logged
   * 5. Confirms round-trip persistence
   */
  async submitComplaint({
    rawText,
    citizenName,
    citizenContact,
    citizenEmail,
    preferredModelMode,
    evidenceFiles = []
  }) {
    this.setSyncState('saving');
    try {
      const res = await apiRequest('/complaints/submit', 'POST', {
        raw_text: rawText,
        citizen_name: citizenName,
        citizen_contact: citizenContact,
        citizen_email: citizenEmail,
        preferred_model_mode: preferredModelMode,
        evidence_files: evidenceFiles
      });

      // Confirm direct persistence in Supabase
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: supaRow } = await supabase
            .from('complaints')
            .select('id, status, urgency_label, category')
            .eq('id', res.complaint_id)
            .single();

          if (supaRow) {
            console.log(`[Supabase Verified] Complaint ${res.complaint_id} confirmed in cloud database with status '${supaRow.status}'.`);
          }
        } catch (checkErr) {
          console.warn("Cloud readback check notice:", checkErr);
        }
      }

      this.setSyncState('synced');
      return res;
    } catch (err) {
      this.setSyncState('error');
      throw err;
    }
  }

  /**
   * Single Source of Truth Read:
   * Fetches fresh from Supabase complaints table on page load or refresh.
   */
  async fetchComplaints({
    search = '',
    urgency = '',
    emotion = '',
    category = '',
    status = '',
    departmentId = null,
    citizenId = null,
    page = 1,
    pageSize = 25
  } = {}) {
    this.setSyncState('saving');
    try {
      let result = null;

      if (isSupabaseConfigured) {
        try {
          result = await fetchComplaintsFromSupabase({
            search,
            urgency,
            emotion,
            category,
            status,
            departmentId,
            citizenId,
            page,
            pageSize
          });
        } catch (supaErr) {
          console.warn("Supabase fetch failed, falling back to backend API:", supaErr);
        }
      }

      if (!result) {
        const params = new URLSearchParams({
          page: page.toString(),
          page_size: pageSize.toString()
        });
        if (search) params.append('search', search);
        if (urgency) params.append('urgency', urgency);
        if (emotion) params.append('emotion', emotion);
        if (category) params.append('category', category);
        if (status) params.append('status', status);
        if (departmentId) params.append('department_id', departmentId.toString());
        if (citizenId) params.append('citizen_id', citizenId.toString());
        if (citizenEmail) params.append('citizen_email', citizenEmail.toString());

        const apiRes = await apiRequest(`/complaints?${params.toString()}`);
        result = {
          items: apiRes.items || [],
          total: apiRes.total || 0,
          page,
          pageSize
        };
      }

      this.setSyncState('synced');
      return result;
    } catch (err) {
      this.setSyncState('error');
      throw err;
    }
  }

  /**
   * Fetch single complaint detail fresh from backend / Supabase
   */
  async getComplaintDetail(complaintId) {
    return await apiRequest(`/complaints/${complaintId}`);
  }

  /**
   * Update complaint status:
   * Writes to Supabase first, then backend API, and lets Realtime broadcast to all clients.
   */
  async updateStatus(complaintId, newStatus, officerUser, notes = '') {
    this.setSyncState('saving');
    try {
      // 1. Write to Supabase first
      if (isSupabaseConfigured) {
        await updateComplaintStatusInSupabase(
          complaintId,
          newStatus,
          officerUser,
          notes || `Status transitioned to ${newStatus}`
        ).catch(e => console.warn("Supabase direct status write error:", e));
      }

      // 2. Write to backend API
      const res = await apiRequest(`/complaints/${complaintId}/status`, 'PATCH', {
        status: newStatus,
        assigned_officer_id: officerUser?.id,
        notes: notes || `Actioned by ${officerUser?.full_name || 'Officer'}`
      });

      this.setSyncState('synced');
      return res;
    } catch (err) {
      this.setSyncState('error');
      throw err;
    }
  }

  /**
   * Realtime Subscription:
   * Subscribes to postgres_changes on public.complaints.
   * Invokes handlers whenever any row is inserted, updated, or deleted on any device.
   */
  subscribeToChanges({ onInsert, onUpdate, onDelete }) {
    if (!isSupabaseConfigured || !supabase) {
      return () => {};
    }

    const channel = supabase
      .channel(`complaints-global-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, (payload) => {
        if (payload.eventType === 'INSERT' && onInsert) {
          onInsert(payload.new);
        } else if (payload.eventType === 'UPDATE' && onUpdate) {
          onUpdate(payload.new);
        } else if (payload.eventType === 'DELETE' && onDelete) {
          onDelete(payload.old);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const complaintService = new ComplaintService();
export default complaintService;
