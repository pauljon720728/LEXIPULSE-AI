-- ==============================================================================
-- LexiPulse AI - Supabase PostgreSQL Schema & Row Level Security (RLS) Setup
-- Final-Year B.Tech Capstone Project
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    category_focus VARCHAR(255) NOT NULL,
    description TEXT,
    contact_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Alias view for singular 'department' if referenced
CREATE OR REPLACE VIEW public.department AS SELECT * FROM public.departments;

-- 3. USERS TABLE (Linked to auth.users UID)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'citizen' NOT NULL CHECK (role IN ('citizen', 'officer', 'admin', 'super_admin')),
    language_pref VARCHAR(10) DEFAULT 'en',
    department_id INTEGER REFERENCES public.departments(id) ON DELETE SET NULL,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 4. COMPLAINTS TABLE
CREATE TABLE IF NOT EXISTS public.complaints (
    id VARCHAR(64) PRIMARY KEY, -- e.g. CMP-2026-0042
    citizen_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    citizen_name VARCHAR(255),
    citizen_contact VARCHAR(100),
    citizen_email VARCHAR(255),

    -- Multilingual NLP & Translation
    raw_text TEXT NOT NULL,
    detected_lang VARCHAR(20) DEFAULT 'en',
    detected_lang_name VARCHAR(50) DEFAULT 'English',
    detected_lang_confidence NUMERIC(5, 4) DEFAULT 1.0,
    translated_text TEXT DEFAULT '',
    translation_confidence VARCHAR(20) DEFAULT 'high',
    language_coverage_confidence VARCHAR(20) DEFAULT 'HIGH',

    -- Emotion & Urgency Classification
    emotion_label VARCHAR(50) DEFAULT 'Pending',
    emotion_confidence NUMERIC(5, 4) DEFAULT 0.0,
    emotion_scores JSONB DEFAULT '{}'::jsonb,

    urgency_label VARCHAR(50) DEFAULT 'Pending',
    urgency_score NUMERIC(5, 2) DEFAULT 0.0,

    category VARCHAR(100) DEFAULT 'Pending Classification',

    -- Explainable AI (XAI)
    explanation_text TEXT,
    trigger_keywords JSONB DEFAULT '[]'::jsonb,

    -- Routing & SLA
    department_id INTEGER REFERENCES public.departments(id) ON DELETE SET NULL,
    assigned_officer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'processing' NOT NULL CHECK (status IN ('processing', 'classified', 'needs_review', 'Submitted', 'Under Review', 'In Investigation', 'Escalated', 'Resolved', 'Dismissed')),
    sla_hours INTEGER DEFAULT 24,
    sla_deadline TIMESTAMPTZ,

    -- Metadata
    evidence_files JSONB DEFAULT '[]'::jsonb,
    model_mode_used VARCHAR(50) DEFAULT 'transformer',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    resolved_at TIMESTAMPTZ
);

-- 5. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    complaint_id VARCHAR(64) REFERENCES public.complaints(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) DEFAULT 'System',
    action VARCHAR(100) NOT NULL,
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 6. MODEL PREDICTIONS TABLE
CREATE TABLE IF NOT EXISTS public.model_predictions (
    id BIGSERIAL PRIMARY KEY,
    complaint_id VARCHAR(64) REFERENCES public.complaints(id) ON DELETE CASCADE,
    model_used VARCHAR(100) NOT NULL,
    raw_llm_response TEXT,
    explanation_text TEXT,
    latency_ms NUMERIC(8, 2) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER (auth.users -> public.users)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, name, email, role, language_pref, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'citizen'),
        COALESCE(NEW.raw_user_meta_data->>'language_pref', 'en'),
        NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        language_pref = EXCLUDED.language_pref,
        phone = EXCLUDED.phone,
        updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_predictions ENABLE ROW LEVEL SECURITY;

-- Helper function to check role of current authenticated user
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS INTEGER AS $$
    SELECT department_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- DEPARTMENTS POLICIES:
-- Everyone can read departments; only Admins can create/edit them
-- ------------------------------------------------------------------------------
CREATE POLICY "Departments are viewable by all authenticated users"
    ON public.departments FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Departments manageable by admins only"
    ON public.departments FOR ALL
    TO authenticated
    USING (public.current_user_role() IN ('admin', 'super_admin'));

-- ------------------------------------------------------------------------------
-- USERS POLICIES:
-- Users can view their own profile; Admins can view/edit all users
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.current_user_role() IN ('admin', 'super_admin', 'officer'));

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR public.current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Admins full management on users"
    ON public.users FOR ALL
    TO authenticated
    USING (public.current_user_role() IN ('admin', 'super_admin'));

-- ------------------------------------------------------------------------------
-- COMPLAINTS POLICIES:
-- 1. Citizens can only read/write their own complaints
-- 2. Officers can read complaints assigned to their department
-- 3. Admins have full read/write access
-- ------------------------------------------------------------------------------
CREATE POLICY "Citizens can insert own complaints"
    ON public.complaints FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = citizen_id OR citizen_id IS NULL);

CREATE POLICY "Citizens can view own complaints"
    ON public.complaints FOR SELECT
    TO authenticated
    USING (
        auth.uid() = citizen_id
        OR public.current_user_role() IN ('admin', 'super_admin')
        OR (
            public.current_user_role() = 'officer'
            AND (department_id IS NULL OR department_id = public.current_user_department() OR assigned_officer_id = auth.uid())
        )
    );

CREATE POLICY "Officers can update department complaints"
    ON public.complaints FOR UPDATE
    TO authenticated
    USING (
        public.current_user_role() IN ('admin', 'super_admin')
        OR (
            public.current_user_role() = 'officer'
            AND (department_id IS NULL OR department_id = public.current_user_department() OR assigned_officer_id = auth.uid())
        )
    );

CREATE POLICY "Admins full control on complaints"
    ON public.complaints FOR ALL
    TO authenticated
    USING (public.current_user_role() IN ('admin', 'super_admin'));

-- ------------------------------------------------------------------------------
-- AUDIT LOG POLICIES:
-- ------------------------------------------------------------------------------
CREATE POLICY "Audit logs viewable by officers and admins, and citizens for their complaints"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() IN ('admin', 'super_admin')
        OR public.current_user_role() = 'officer'
        OR EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = audit_log.complaint_id AND c.citizen_id = auth.uid()
        )
    );

CREATE POLICY "Audit logs insertable by authenticated users and system"
    ON public.audit_log FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- MODEL PREDICTIONS POLICIES:
-- ------------------------------------------------------------------------------
CREATE POLICY "Predictions viewable by officers and admins"
    ON public.model_predictions FOR SELECT
    TO authenticated
    USING (public.current_user_role() IN ('officer', 'admin', 'super_admin'));

CREATE POLICY "Predictions insertable by system"
    ON public.model_predictions FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'complaints'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'audit_log'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'users'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;
END $$;
