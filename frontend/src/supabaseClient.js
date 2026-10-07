import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project') &&
  supabaseUrl.startsWith('https://')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Register user in Supabase Auth & public.users table
 */
export async function registerUser({ email, password, fullName, role = 'citizen', languagePref = 'en', phone = '' }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured yet. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
        language_pref: languagePref,
        phone,
      },
    },
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  if (!user) {
    throw new Error("Registration completed, please check your email for a verification link.");
  }

  // Ensure matching row in public.users table
  const { error: profileError } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      name: fullName,
      email: email,
      role: role,
      language_pref: languagePref,
      phone: phone,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (profileError) {
    console.warn("Could not insert matching profile into public.users:", profileError);
  }

  return { user, session: data.session };
}

/**
 * Login user via Supabase Auth & retrieve full role metadata from public.users
 */
export async function loginUser({ email, password }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured yet. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  const authUser = data.user;

  // Fetch full user record from public.users table
  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (profileErr && !profile) {
    // If not found in public.users, fallback to user_metadata
    const meta = authUser.user_metadata || {};
    return {
      session: data.session,
      user: {
        id: authUser.id,
        email: authUser.email,
        full_name: meta.full_name || authUser.email.split('@')[0],
        role: meta.role || 'citizen',
        language_pref: meta.language_pref || 'en',
        is_active: true,
      },
    };
  }

  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    throw new Error("Your account has been deactivated or suspended by an Administrator.");
  }

  // Update last_sign_in_at
  await supabase
    .from('users')
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq('id', authUser.id);

  return {
    session: data.session,
    user: {
      ...profile,
      full_name: profile.name, // Compatibility with existing UI
    },
  };
}

/**
 * Sign out
 */
export async function logoutUser() {
  if (supabase) {
    await supabase.auth.signOut();
  }
}

/**
 * Fetch complaints fresh from Supabase
 */
export async function fetchComplaintsFromSupabase({
  search = '',
  urgency = '',
  emotion = '',
  category = '',
  status = '',
  citizenId = null,
  departmentId = null,
  page = 1,
  pageSize = 25,
} = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  let query = supabase
    .from('complaints')
    .select('*, departments(id, name, code)', { count: 'exact' });

  if (citizenId) {
    query = query.eq('citizen_id', citizenId);
  }
  if (departmentId) {
    query = query.eq('department_id', departmentId);
  }
  if (urgency) {
    query = query.eq('urgency_label', urgency);
  }
  if (emotion) {
    query = query.eq('emotion_label', emotion);
  }
  if (category) {
    query = query.eq('category', category);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (search) {
    query = query.or(`raw_text.ilike.%${search}%,translated_text.ilike.%${search}%,id.ilike.%${search}%,citizen_name.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    items: data || [],
    total: count || 0,
    page,
    page_size: pageSize,
  };
}

/**
 * Create or save complaint directly to Supabase
 */
export async function saveComplaintToSupabase(complaintData) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('complaints')
    .insert([complaintData])
    .select()
    .single();

  if (error) throw error;

  // Insert initial audit log
  await supabase.from('audit_log').insert([{
    complaint_id: complaintData.id,
    user_id: complaintData.citizen_id || null,
    user_name: complaintData.citizen_name || 'Citizen',
    action: 'Created',
    details: `Complaint submitted in ${complaintData.detected_lang_name || 'Detected Language'}. Urgency: ${complaintData.urgency_label}.`,
    timestamp: new Date().toISOString(),
  }]).select();

  return data;
}

/**
 * Update complaint status & write audit log to Supabase
 */
export async function updateComplaintStatusInSupabase(complaintId, newStatus, officerUser, detailsText = '') {
  if (!isSupabaseConfigured || !supabase) return null;

  const updatePayload = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === 'Resolved') {
    updatePayload.resolved_at = new Date().toISOString();
  }
  if (officerUser?.id) {
    updatePayload.assigned_officer_id = officerUser.id;
  }

  const { data, error } = await supabase
    .from('complaints')
    .update(updatePayload)
    .eq('id', complaintId)
    .select()
    .single();

  if (error) throw error;

  // Write audit log entry
  await supabase.from('audit_log').insert([{
    complaint_id: complaintId,
    user_id: officerUser?.id || null,
    user_name: officerUser?.full_name || officerUser?.name || 'Officer',
    action: `Status: ${newStatus}`,
    details: detailsText || `Status transitioned to ${newStatus}`,
    timestamp: new Date().toISOString(),
  }]);

  return data;
}

/**
 * Realtime subscription to complaints table
 */
export function subscribeToRealtimeComplaints(onPayload) {
  if (!isSupabaseConfigured || !supabase) return () => {};

  const channel = supabase
    .channel('complaints-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, (payload) => {
      onPayload(payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Fetch all users for Admin User Management
 */
export async function fetchAllUsersFromSupabase() {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('users')
    .select('*, departments(id, name, code)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Promote or update user role & department
 */
export async function updateUserRoleInSupabase(userId, newRole, departmentId = null) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .update({
      role: newRole,
      department_id: departmentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Toggle user active/suspended state
 */
export async function toggleUserActiveStatusInSupabase(userId, isActive) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch audit activity for a user
 */
export async function fetchUserAuditLogsFromSupabase(userId) {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}
