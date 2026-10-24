-- ==============================================================================
-- BUSINESS ADMINISTRATION DYNAMIC QR ATTENDANCE SYSTEM - SEED DATA
-- ==============================================================================

-- 1. Seed Majors
INSERT INTO public.majors (id, code, name, description) VALUES
    ('11111111-1111-1111-1111-111111111111', 'MM', 'BSBA in Marketing Management', 'Focus on market research, brand strategy, digital consumer analytics, and professional selling.'),
    ('22222222-2222-2222-2222-222222222222', 'FM', 'BSBA in Financial Management', 'Focus on corporate finance, investment analysis, capital budgeting, and fintech systems.'),
    ('33333333-3333-3333-3333-333333333333', 'HRM', 'BSBA in Human Resource Management', 'Focus on strategic talent acquisition, organizational behavior, and labor law compliance.'),
    ('44444444-4444-4444-4444-444444444444', 'OM', 'BSBA in Operations Management', 'Focus on supply chain logistics, quality management, enterprise systems, and process optimization.')
ON CONFLICT (code) DO NOTHING;

-- 2. Seed Year Levels
INSERT INTO public.year_levels (id, level, name) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '1st Year'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, '2nd Year'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 3, '3rd Year'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 4, '4th Year')
ON CONFLICT (level) DO NOTHING;

-- 3. Seed Sections
INSERT INTO public.sections (id, major_id, year_level_id, section_name) VALUES
    ('s1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'BA-MM 3-1'),
    ('s2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'BA-FM 4-1'),
    ('s3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'BA-HRM 2-1'),
    ('s4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'BA-OM 1-1')
ON CONFLICT DO NOTHING;

-- 4. Seed Academic Years
INSERT INTO public.academic_years (id, code, semester, is_active) VALUES
    ('y2026111-1111-1111-1111-111111111111', '2026-2027', '1st', true),
    ('y2026222-2222-2222-2222-222222222222', '2026-2027', '2nd', false)
ON CONFLICT (code, semester) DO NOTHING;

-- 5. Seed System Settings
INSERT INTO public.system_settings (key, value, description) VALUES
    ('qr_default_expiry_seconds', '45', 'Time window in seconds before student QR codes rotate and expire.'),
    ('default_grace_period_mins', '15', 'Default minutes after session start before attendance is marked as late.'),
    ('min_stay_duration_ratio', '0.75', 'Minimum percentage of session duration required to qualify for certificate.'),
    ('allow_manual_id_entry', 'true', 'Allows authorized attendance officers to manually enter student IDs as fallback.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
