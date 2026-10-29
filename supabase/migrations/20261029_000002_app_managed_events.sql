-- Events are now stored in Supabase by the app's API routes (service role)
-- instead of in server memory, which reset on every restart and differed
-- between serverless instances (deleted events came back).
--
-- * Staff sign in with the app's own session, which may have no Supabase
--   profile, so the organizer is recorded by name and email.
-- * New events have no category and no minimum stay.
-- Safe to run more than once.

ALTER TABLE public.events ALTER COLUMN category DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN organizer_id DROP NOT NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS organizer_name TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS organizer_email TEXT;
ALTER TABLE public.events ALTER COLUMN min_attendance_duration_mins SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS events_start_time_idx ON public.events (start_time);
CREATE INDEX IF NOT EXISTS event_sessions_event_id_idx ON public.event_sessions (event_id, order_index);
