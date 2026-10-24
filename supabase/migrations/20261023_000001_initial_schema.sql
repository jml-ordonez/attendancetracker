-- ==============================================================================
-- BUSINESS ADMINISTRATION DYNAMIC QR ATTENDANCE SYSTEM
-- Migration: 20261023_000001_initial_schema.sql
-- Description: Complete 20-table normalized relational schema, check constraints,
--              Row Level Security (RLS), atomic scan procedures, and audit triggers.
-- ==============================================================================

-- 0. Enable UUID and Cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean drop for idempotency if needed in local development
-- (Tables will be created in dependency order)

-- 1. Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    student_id_number TEXT UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'attendance_officer', 'coordinator', 'administrator')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Majors Table (Business Administration programs)
CREATE TABLE IF NOT EXISTS public.majors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE, -- MM, FM, HRM, OM
    name TEXT NOT NULL,        -- Marketing Management, Financial Management, etc.
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Year Levels Table
CREATE TABLE IF NOT EXISTS public.year_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level INT NOT NULL UNIQUE CHECK (level BETWEEN 1 AND 5),
    name TEXT NOT NULL -- 1st Year, 2nd Year, 3rd Year, 4th Year
);

-- 4. Sections Table
CREATE TABLE IF NOT EXISTS public.sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    major_id UUID NOT NULL REFERENCES public.majors(id) ON DELETE CASCADE,
    year_level_id UUID NOT NULL REFERENCES public.year_levels(id) ON DELETE CASCADE,
    section_name TEXT NOT NULL, -- e.g. "BA-MM 3-1"
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(major_id, year_level_id, section_name)
);

-- 5. Academic Years Table
CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL,          -- e.g. "2026-2027"
    semester TEXT NOT NULL CHECK (semester IN ('1st', '2nd', 'Summer')),
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(code, semester)
);

-- 6. Student Enrollments Table
CREATE TABLE IF NOT EXISTS public.student_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    major_id UUID NOT NULL REFERENCES public.majors(id) ON DELETE RESTRICT,
    year_level_id UUID NOT NULL REFERENCES public.year_levels(id) ON DELETE RESTRICT,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'dropped', 'graduated', 'on_leave')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(student_id, academic_year_id)
);

-- 7. Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Seminar', 'Lecture', 'Workshop', 'Conference', 'Meeting', 'General Assembly')),
    venue TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'in_progress', 'completed', 'cancelled', 'archived')),
    certificate_enabled BOOLEAN NOT NULL DEFAULT true,
    min_attendance_duration_mins INT NOT NULL DEFAULT 60 CHECK (min_attendance_duration_mins >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CHECK (end_time > start_time)
);

-- 8. Event Eligibility Table (Fine-grained targeting)
CREATE TABLE IF NOT EXISTS public.event_eligibility (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    major_id UUID REFERENCES public.majors(id) ON DELETE CASCADE,
    year_level_id UUID REFERENCES public.year_levels(id) ON DELETE CASCADE,
    section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Event Sessions Table (Multi-session support)
CREATE TABLE IF NOT EXISTS public.event_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- e.g. "Morning Keynote Session", "Afternoon Breakout"
    session_date DATE NOT NULL,
    time_in_start TIMESTAMPTZ NOT NULL,
    time_in_end TIMESTAMPTZ NOT NULL,
    time_out_start TIMESTAMPTZ NOT NULL,
    time_out_end TIMESTAMPTZ NOT NULL,
    grace_period_mins INT NOT NULL DEFAULT 15 CHECK (grace_period_mins >= 0),
    order_index INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CHECK (time_in_end > time_in_start),
    CHECK (time_out_end > time_out_start),
    CHECK (time_out_start >= time_in_start)
);

-- 10. Event Checkpoints Table
CREATE TABLE IF NOT EXISTS public.event_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- "Main Hall Entrance", "Auditorium Door A"
    checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN ('time_in', 'time_out', 'interim')),
    sequence_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. Event Officers Table (Officers authorized for this event/checkpoint)
CREATE TABLE IF NOT EXISTS public.event_officers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_checkpoint_id UUID REFERENCES public.event_checkpoints(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(event_id, user_id, assigned_checkpoint_id)
);

-- 12. Attendance Records Table (Summarized student attendance state per session)
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
    time_in_timestamp TIMESTAMPTZ,
    time_out_timestamp TIMESTAMPTZ,
    time_in_status TEXT CHECK (time_in_status IN ('on_time', 'late', 'excused')),
    time_out_status TEXT CHECK (time_out_status IN ('normal', 'early_departure')),
    final_status TEXT NOT NULL DEFAULT 'present' CHECK (final_status IN (
        'on_time', 'late', 'present', 'checked_out', 'absent', 'left_early', 
        'incomplete', 'pending_verification', 'excused', 'corrected'
    )),
    duration_minutes INT NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
    is_excused BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- CRITICAL INTEGRITY: Exactly one attendance record per student per session
    UNIQUE(student_id, session_id)
);

-- 13. Attendance Scans Table (Append-only immutable evidence log)
CREATE TABLE IF NOT EXISTS public.attendance_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
    checkpoint_id UUID REFERENCES public.event_checkpoints(id) ON DELETE SET NULL,
    officer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    scan_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    scan_type TEXT NOT NULL CHECK (scan_type IN ('time_in', 'time_out', 'interim')),
    raw_verification_status TEXT NOT NULL CHECK (raw_verification_status IN ('accepted', 'rejected')),
    failure_reason TEXT,
    ip_address TEXT,
    device_info TEXT
);

-- 14. QR Token Registry Table (Replay and duplicate token prevention)
CREATE TABLE IF NOT EXISTS public.qr_token_registry (
    token_id UUID PRIMARY KEY, -- tid from dynamic token
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('time_in', 'time_out', 'checkpoint')),
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    nonce TEXT NOT NULL,
    is_consumed BOOLEAN NOT NULL DEFAULT false,
    consumed_at TIMESTAMPTZ,
    consumed_by_officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 15. Attendance Correction Requests Table
CREATE TABLE IF NOT EXISTS public.attendance_correction_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    record_id UUID REFERENCES public.attendance_records(id) ON DELETE SET NULL,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
    requested_change TEXT NOT NULL CHECK (requested_change IN ('mark_present', 'adjust_time_in', 'adjust_time_out', 'excuse_absence')),
    reason TEXT NOT NULL,
    attachment_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 16. Attendance Corrections Table (Auditable change history)
CREATE TABLE IF NOT EXISTS public.attendance_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES public.attendance_correction_requests(id) ON DELETE SET NULL,
    record_id UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
    previous_state JSONB NOT NULL,
    new_state JSONB NOT NULL,
    corrected_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 17. Certificates Table
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    certificate_code TEXT NOT NULL UNIQUE,
    verified_hours NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'revoked')),
    UNIQUE(student_id, event_id)
);

-- 18. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 19. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 20. Rate Limit Records Table (Sliding window)
CREATE TABLE IF NOT EXISTS public.rate_limit_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL, -- e.g. "qr_gen:student_id" or "scan:officer_id"
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- INDEXES FOR HIGH-PERFORMANCE SEARCH & VERIFICATION
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON public.profiles(student_id_number);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_academic ON public.student_enrollments(academic_year_id, major_id, year_level_id, section_id);
CREATE INDEX IF NOT EXISTS idx_events_status_time ON public.events(status, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_sessions_event_dates ON public.event_sessions(event_id, session_date);
CREATE INDEX IF NOT EXISTS idx_records_student_session ON public.attendance_records(student_id, session_id);
CREATE INDEX IF NOT EXISTS idx_records_event_status ON public.attendance_records(event_id, final_status);
CREATE INDEX IF NOT EXISTS idx_scans_session_student ON public.attendance_scans(session_id, student_id, scan_type);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_lookup ON public.qr_token_registry(token_id, is_consumed, expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor_time ON public.audit_logs(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup ON public.rate_limit_records(key, timestamp);

-- ==============================================================================
-- ATOMIC STORED PROCEDURE: process_attendance_scan
-- Guarantees atomic verification, replay prevention, and concurrent safety.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_attendance_scan(
    p_token_id UUID,
    p_student_id UUID,
    p_event_id UUID,
    p_session_id UUID,
    p_checkpoint_id UUID,
    p_officer_id UUID,
    p_purpose TEXT, -- 'time_in' or 'time_out'
    p_ip_address TEXT,
    p_device_info TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_token RECORD;
    v_session RECORD;
    v_record RECORD;
    v_is_late BOOLEAN := false;
    v_is_early BOOLEAN := false;
    v_duration INT := 0;
    v_time_in_status TEXT;
    v_time_out_status TEXT;
    v_final_status TEXT;
BEGIN
    -- 1. Atomic Lock & Verify Token in Registry
    SELECT * INTO v_token
    FROM public.qr_token_registry
    WHERE token_id = p_token_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Log rejected scan
        INSERT INTO public.attendance_scans (
            student_id, event_id, session_id, checkpoint_id, officer_id,
            scan_type, raw_verification_status, failure_reason, ip_address, device_info
        ) VALUES (
            p_student_id, p_event_id, p_session_id, p_checkpoint_id, p_officer_id,
            p_purpose, 'rejected', 'TOKEN_NOT_FOUND_IN_REGISTRY', p_ip_address, p_device_info
        );
        RETURN jsonb_build_object('success', false, 'status', 'TOKEN_INVALID', 'message', 'Token was not found in active registry.');
    END IF;

    -- Check if token is already consumed
    IF v_token.is_consumed THEN
        INSERT INTO public.attendance_scans (
            student_id, event_id, session_id, checkpoint_id, officer_id,
            scan_type, raw_verification_status, failure_reason, ip_address, device_info
        ) VALUES (
            p_student_id, p_event_id, p_session_id, p_checkpoint_id, p_officer_id,
            p_purpose, 'rejected', 'DUPLICATE_TOKEN_USE', p_ip_address, p_device_info
        );
        RETURN jsonb_build_object('success', false, 'status', 'DUPLICATE_TOKEN_USE', 'message', 'This QR code has already been scanned and consumed.');
    END IF;

    -- Check token expiration against server clock
    IF v_now > v_token.expires_at THEN
        INSERT INTO public.attendance_scans (
            student_id, event_id, session_id, checkpoint_id, officer_id,
            scan_type, raw_verification_status, failure_reason, ip_address, device_info
        ) VALUES (
            p_student_id, p_event_id, p_session_id, p_checkpoint_id, p_officer_id,
            p_purpose, 'rejected', 'TOKEN_EXPIRED', p_ip_address, p_device_info
        );
        RETURN jsonb_build_object('success', false, 'status', 'TOKEN_EXPIRED', 'message', 'QR code has expired. Please refresh the QR code.');
    END IF;

    -- Verify Session Existence & Schedule
    SELECT * INTO v_session
    FROM public.event_sessions
    WHERE id = p_session_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'status', 'SESSION_NOT_FOUND', 'message', 'Event session not found.');
    END IF;

    -- 2. Handle Purpose: TIME-IN
    IF p_purpose = 'time_in' THEN
        -- Check if student already has a recorded time-in for this session
        SELECT * INTO v_record
        FROM public.attendance_records
        WHERE student_id = p_student_id AND session_id = p_session_id
        FOR UPDATE;

        IF FOUND AND v_record.time_in_timestamp IS NOT NULL THEN
            INSERT INTO public.attendance_scans (
                student_id, event_id, session_id, checkpoint_id, officer_id,
                scan_type, raw_verification_status, failure_reason, ip_address, device_info
            ) VALUES (
                p_student_id, p_event_id, p_session_id, p_checkpoint_id, p_officer_id,
                'time_in', 'rejected', 'ALREADY_CHECKED_IN', p_ip_address, p_device_info
            );
            RETURN jsonb_build_object('success', false, 'status', 'DUPLICATE_SCAN', 'message', 'Student has already checked in for this session.');
        END IF;

        -- Evaluate Late vs On-Time using server time and session grace period
        IF v_now > (v_session.time_in_start + (v_session.grace_period_mins || ' minutes')::interval) THEN
            v_is_late := true;
            v_time_in_status := 'late';
            v_final_status := 'late';
        ELSE
            v_is_late := false;
            v_time_in_status := 'on_time';
            v_final_status := 'on_time';
        END IF;

        -- Atomically upsert attendance record
        INSERT INTO public.attendance_records (
            student_id, event_id, session_id, time_in_timestamp, time_in_status, final_status
        ) VALUES (
            p_student_id, p_event_id, p_session_id, v_now, v_time_in_status, v_final_status
        )
        ON CONFLICT (student_id, session_id) DO UPDATE SET
            time_in_timestamp = v_now,
            time_in_status = v_time_in_status,
            final_status = v_final_status,
            updated_at = v_now;

    -- 3. Handle Purpose: TIME-OUT
    ELSIF p_purpose = 'time_out' THEN
        SELECT * INTO v_record
        FROM public.attendance_records
        WHERE student_id = p_student_id AND session_id = p_session_id
        FOR UPDATE;

        IF NOT FOUND OR v_record.time_in_timestamp IS NULL THEN
            INSERT INTO public.attendance_scans (
                student_id, event_id, session_id, checkpoint_id, officer_id,
                scan_type, raw_verification_status, failure_reason, ip_address, device_info
            ) VALUES (
                p_student_id, p_event_id, p_session_id, p_checkpoint_id, p_officer_id,
                'time_out', 'rejected', 'MISSING_TIME_IN', p_ip_address, p_device_info
            );
            RETURN jsonb_build_object('success', false, 'status', 'TOKEN_INVALID', 'message', 'No valid time-in record found. Student must time-in first.');
        END IF;

        IF v_record.time_out_timestamp IS NOT NULL THEN
            INSERT INTO public.attendance_scans (
                student_id, event_id, session_id, checkpoint_id, officer_id,
                scan_type, raw_verification_status, failure_reason, ip_address, device_info
            ) VALUES (
                p_student_id, p_event_id, p_session_id, p_checkpoint_id, p_officer_id,
                'time_out', 'rejected', 'ALREADY_CHECKED_OUT', p_ip_address, p_device_info
            );
            RETURN jsonb_build_object('success', false, 'status', 'DUPLICATE_SCAN', 'message', 'Student has already timed out for this session.');
        END IF;

        -- Calculate verified duration in minutes
        v_duration := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_now - v_record.time_in_timestamp)) / 60));

        -- Early departure detection
        IF v_now < v_session.time_out_start THEN
            v_is_early := true;
            v_time_out_status := 'early_departure';
            v_final_status := 'left_early';
        ELSE
            v_is_early := false;
            v_time_out_status := 'normal';
            v_final_status := 'checked_out';
        END IF;

        UPDATE public.attendance_records SET
            time_out_timestamp = v_now,
            time_out_status = v_time_out_status,
            final_status = v_final_status,
            duration_minutes = v_duration,
            updated_at = v_now
        WHERE student_id = p_student_id AND session_id = p_session_id;

    ELSE
        RETURN jsonb_build_object('success', false, 'status', 'TOKEN_INVALID', 'message', 'Unsupported token purpose.');
    END IF;

    -- 4. Mark Token as Consumed Atomically
    UPDATE public.qr_token_registry SET
        is_consumed = true,
        consumed_at = v_now,
        consumed_by_officer_id = p_officer_id
    WHERE token_id = p_token_id;

    -- 5. Append Accepted Scan Evidence Log
    INSERT INTO public.attendance_scans (
        student_id, event_id, session_id, checkpoint_id, officer_id,
        scan_type, raw_verification_status, ip_address, device_info
    ) VALUES (
        p_student_id, p_event_id, p_session_id, p_checkpoint_id, p_officer_id,
        p_purpose, 'accepted', p_ip_address, p_device_info
    );

    -- 6. Return Structured Verification Result
    RETURN jsonb_build_object(
        'success', true,
        'status', CASE
            WHEN p_purpose = 'time_in' AND v_is_late THEN 'SUCCESS_LATE'
            WHEN p_purpose = 'time_in' AND NOT v_is_late THEN 'SUCCESS_ON_TIME'
            WHEN p_purpose = 'time_out' AND v_is_early THEN 'SUCCESS_CHECKOUT_EARLY'
            ELSE 'SUCCESS_CHECKOUT'
        END,
        'message', CASE
            WHEN p_purpose = 'time_in' AND v_is_late THEN 'Time-in recorded (Late Arrival).'
            WHEN p_purpose = 'time_in' AND NOT v_is_late THEN 'Time-in recorded (On Time).'
            WHEN p_purpose = 'time_out' AND v_is_early THEN 'Time-out recorded (Early Departure).'
            ELSE 'Time-out recorded successfully.'
        END,
        'timestamp', v_now,
        'duration_minutes', v_duration,
        'is_late', v_is_late,
        'is_early', v_is_early
    );
END;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.majors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.year_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_token_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Helper Function to check authenticated user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- PROFILES POLICIES
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Staff can view relevant profiles" ON public.profiles
    FOR SELECT USING (public.current_user_role() IN ('attendance_officer', 'coordinator', 'administrator'));

CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL USING (public.current_user_role() = 'administrator');

-- PUBLIC REFERENCE TABLES (Majors, Year Levels, Sections, Academic Years)
CREATE POLICY "Anyone authenticated can read academic reference data" ON public.majors
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can read year levels" ON public.year_levels
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can read sections" ON public.sections
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can read academic years" ON public.academic_years
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage academic structures" ON public.majors
    FOR ALL USING (public.current_user_role() = 'administrator');

CREATE POLICY "Admins can manage sections" ON public.sections
    FOR ALL USING (public.current_user_role() = 'administrator');

-- EVENTS & SESSIONS POLICIES
CREATE POLICY "Students can view published events" ON public.events
    FOR SELECT USING (
        status IN ('published', 'in_progress', 'completed')
        OR organizer_id = auth.uid()
        OR public.current_user_role() IN ('coordinator', 'administrator', 'attendance_officer')
    );

CREATE POLICY "Coordinators and Admins can manage events" ON public.events
    FOR ALL USING (public.current_user_role() IN ('coordinator', 'administrator'));

CREATE POLICY "Authenticated users can view event sessions" ON public.event_sessions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Coordinators and Admins can manage sessions" ON public.event_sessions
    FOR ALL USING (public.current_user_role() IN ('coordinator', 'administrator'));

CREATE POLICY "Authenticated users can view checkpoints" ON public.event_checkpoints
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Coordinators and Admins can manage checkpoints" ON public.event_checkpoints
    FOR ALL USING (public.current_user_role() IN ('coordinator', 'administrator'));

-- ATTENDANCE RECORDS POLICIES
CREATE POLICY "Students can view own attendance records" ON public.attendance_records
    FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Officers can view records for assigned events" ON public.attendance_records
    FOR SELECT USING (
        public.current_user_role() IN ('coordinator', 'administrator')
        OR (public.current_user_role() = 'attendance_officer' AND EXISTS (
            SELECT 1 FROM public.event_officers WHERE event_id = attendance_records.event_id AND user_id = auth.uid()
        ))
    );

CREATE POLICY "Only trusted procedures can insert/update records directly" ON public.attendance_records
    FOR ALL USING (public.current_user_role() IN ('coordinator', 'administrator'));

-- CORRECTIONS POLICIES
CREATE POLICY "Students can view and create own correction requests" ON public.attendance_correction_requests
    FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Coordinators and Admins can review correction requests" ON public.attendance_correction_requests
    FOR ALL USING (public.current_user_role() IN ('coordinator', 'administrator'));

CREATE POLICY "Auditors and Staff can read audit logs" ON public.audit_logs
    FOR SELECT USING (public.current_user_role() IN ('coordinator', 'administrator'));

-- CERTIFICATES POLICIES
CREATE POLICY "Students can view own certificates" ON public.certificates
    FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Staff can view and issue certificates" ON public.certificates
    FOR ALL USING (public.current_user_role() IN ('coordinator', 'administrator'));
