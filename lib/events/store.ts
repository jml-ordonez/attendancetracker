import { createAdminClient } from "@/lib/supabase/admin";
import type { BAEvent, EventSession, EventStatus } from "@/types/events";

/**
 * Department events and their sessions.
 *
 * Stored in Supabase (`events` + `event_sessions`) when it is configured. The
 * old store kept events in server memory: every restart re-seeded the sample
 * events (so deleted ones came back) and each serverless instance had its own
 * copy. Without Supabase (tests, offline demos) a seeded in-memory store is used.
 * Seed times are in Philippine time (UTC+8).
 */

export class EventStoreError extends Error {}

export interface SessionMatch {
  event: BAEvent;
  session: EventSession;
}

/** Fields an edit can change; sessions are written as a whole when given. */
export type EventChanges = Partial<Pick<BAEvent, "title" | "description" | "venue" | "start_time" | "end_time" | "status">> & {
  sessions?: EventSession[];
};

const SEED: BAEvent[] = [
  {
    id: "a2b4c6d8-1111-2222-3333-444455556666",
    title: "Annual BA Leadership Summit 2026",
    description: "Academic assembly on artificial intelligence in commerce and corporate management.",
    category: "Seminar",
    venue: "Main University Auditorium, Hall A",
    start_time: "2026-10-24T08:00:00+08:00",
    end_time: "2026-10-24T17:00:00+08:00",
    organizer_id: "admin-system",
    organizer_name: "BA Department",
    status: "published",
    certificate_enabled: true,
    min_attendance_duration_mins: 180,
    created_at: "2026-10-20T09:00:00+08:00",
    updated_at: "2026-10-23T09:00:00+08:00",
    sessions: [
      {
        id: "b3c5d7e9-2222-3333-4444-555566667777",
        event_id: "a2b4c6d8-1111-2222-3333-444455556666",
        title: "Morning keynote: AI in global enterprise",
        session_date: "2026-10-24",
        time_in_start: "2026-10-24T08:00:00+08:00",
        time_in_end: "2026-10-24T09:00:00+08:00",
        time_out_start: "2026-10-24T12:00:00+08:00",
        time_out_end: "2026-10-24T13:00:00+08:00",
        grace_period_mins: 15,
        order_index: 1,
      },
      {
        id: "c4d6e8fa-3333-4444-5555-666677778888",
        event_id: "a2b4c6d8-1111-2222-3333-444455556666",
        title: "Afternoon plenary: Leading through disruption",
        session_date: "2026-10-24",
        time_in_start: "2026-10-24T13:00:00+08:00",
        time_in_end: "2026-10-24T14:00:00+08:00",
        time_out_start: "2026-10-24T16:00:00+08:00",
        time_out_end: "2026-10-24T17:00:00+08:00",
        grace_period_mins: 15,
        order_index: 2,
      },
    ],
  },
  {
    id: "5f1e2d3c-4b5a-4968-8776-655443322110",
    title: "Financial Analytics & FinTech Convention",
    description: "Predictive financial modelling, algorithmic risk and treasury management.",
    category: "Conference",
    venue: "Business Hall, Room 302",
    start_time: "2026-11-05T09:00:00+08:00",
    end_time: "2026-11-05T15:00:00+08:00",
    organizer_id: "admin-system",
    organizer_name: "Financial Management",
    status: "published",
    certificate_enabled: true,
    min_attendance_duration_mins: 120,
    created_at: "2026-10-21T09:00:00+08:00",
    updated_at: "2026-10-23T09:00:00+08:00",
    sessions: [
      {
        id: "6a2f3e4d-5c6b-4a79-8887-766554433221",
        event_id: "5f1e2d3c-4b5a-4968-8776-655443322110",
        title: "Main convention",
        session_date: "2026-11-05",
        time_in_start: "2026-11-05T09:00:00+08:00",
        time_in_end: "2026-11-05T10:00:00+08:00",
        time_out_start: "2026-11-05T14:00:00+08:00",
        time_out_end: "2026-11-05T15:00:00+08:00",
        grace_period_mins: 15,
        order_index: 1,
      },
    ],
  },
  {
    id: "7b3a4f5e-6d7c-4b8a-9998-877665544332",
    title: "Operations & Supply Chain Logistics Workshop",
    description: "ERP warehouse simulation and lean manufacturing practice.",
    category: "Workshop",
    venue: "Engineering & BA Lab, Room 104",
    start_time: "2026-11-12T13:00:00+08:00",
    end_time: "2026-11-12T17:00:00+08:00",
    organizer_id: "admin-system",
    organizer_name: "Operations Management",
    status: "draft",
    certificate_enabled: true,
    min_attendance_duration_mins: 90,
    created_at: "2026-10-22T09:00:00+08:00",
    updated_at: "2026-10-23T09:00:00+08:00",
    sessions: [
      {
        id: "8c4b5a6f-7e8d-4c9b-8aa9-988776655443",
        event_id: "7b3a4f5e-6d7c-4b8a-9998-877665544332",
        title: "Workshop",
        session_date: "2026-11-12",
        time_in_start: "2026-11-12T13:00:00+08:00",
        time_in_end: "2026-11-12T14:00:00+08:00",
        time_out_start: "2026-11-12T16:00:00+08:00",
        time_out_end: "2026-11-12T17:00:00+08:00",
        grace_period_mins: 10,
        order_index: 1,
      },
    ],
  },
];

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const time = (iso: string) => new Date(iso).getTime();
const byStart = (a: BAEvent, b: BAEvent) => time(a.start_time) - time(b.start_time);
const bySessionOrder = (a: EventSession, b: EventSession) => a.order_index - b.order_index;

function supabaseConfigured(): boolean {
  return (
    !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
    !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
  );
}

/* ---------------------------------------------------------------- memory */

const g = globalThis as unknown as {
  __ba_events?: BAEvent[];
  /** Last list read from Supabase, reused briefly by the scan path. */
  __ba_events_cache?: { at: number; events: BAEvent[] };
};

function memory(): BAEvent[] {
  return (g.__ba_events ??= structuredClone(SEED));
}

/* -------------------------------------------------------------- supabase */

interface EventRow {
  id: string;
  title: string;
  description: string;
  category: BAEvent["category"] | null;
  venue: string;
  start_time: string;
  end_time: string;
  organizer_id: string | null;
  organizer_name: string | null;
  organizer_email: string | null;
  status: EventStatus;
  certificate_enabled: boolean;
  min_attendance_duration_mins: number;
  created_at: string;
  updated_at: string;
  sessions?: (EventSession & { created_at?: string })[];
}

const SELECT = "*, sessions:event_sessions(*)";

function fromRow(row: EventRow): BAEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ...(row.category ? { category: row.category } : {}),
    venue: row.venue,
    start_time: row.start_time,
    end_time: row.end_time,
    organizer_id: row.organizer_email ?? row.organizer_id ?? "",
    organizer_name: row.organizer_name ?? undefined,
    status: row.status,
    certificate_enabled: row.certificate_enabled,
    min_attendance_duration_mins: row.min_attendance_duration_mins,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sessions: (row.sessions ?? [])
      .map((s) => ({
        id: s.id,
        event_id: s.event_id,
        title: s.title,
        session_date: s.session_date,
        time_in_start: s.time_in_start,
        time_in_end: s.time_in_end,
        time_out_start: s.time_out_start,
        time_out_end: s.time_out_end,
        grace_period_mins: s.grace_period_mins,
        order_index: s.order_index,
      }))
      .sort(bySessionOrder),
  };
}

function sessionRows(eventId: string, sessions: EventSession[]) {
  return sessions.map((s) => ({
    id: s.id,
    event_id: eventId,
    title: s.title,
    session_date: s.session_date,
    time_in_start: s.time_in_start,
    time_in_end: s.time_in_end,
    time_out_start: s.time_out_start,
    time_out_end: s.time_out_end,
    grace_period_mins: s.grace_period_mins,
    order_index: s.order_index,
  }));
}

/** Turns a Supabase error into one a person can act on; the details go to the server log. */
function dbError(action: string, error: { code?: string; message: string }): EventStoreError {
  // Spelled out: Supabase error objects print as {} in the Next.js log.
  console.error(`[events] couldn't ${action}: ${error.code ?? "?"} ${error.message}`);
  // PGRST204: a column the app writes doesn't exist. 23502: a NOT NULL column the app leaves empty.
  if (error.code === "PGRST204" || error.code === "23502") {
    return new EventStoreError(
      "The database needs the events update. Run supabase/migrations/20261029_000002_app_managed_events.sql in the Supabase SQL editor, then try again."
    );
  }
  return new EventStoreError(`Couldn't ${action}. Try again in a moment.`);
}

function invalidate() {
  g.__ba_events_cache = undefined;
}

/* ----------------------------------------------------------------- reads */

/** Every event, soonest first, read fresh from the store. */
export async function listEvents(): Promise<BAEvent[]> {
  if (!supabaseConfigured()) return [...memory()].sort(byStart);
  const { data, error } = await createAdminClient().from("events").select(SELECT).order("start_time");
  if (error) throw dbError("load the events", error);
  const events = (data as EventRow[]).map(fromRow);
  g.__ba_events_cache = { at: Date.now(), events };
  return events;
}

export async function getEvent(id: string): Promise<BAEvent | undefined> {
  if (!supabaseConfigured()) return memory().find((e) => e.id === id);
  if (!GUID.test(id)) return undefined;
  const { data, error } = await createAdminClient().from("events").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw dbError("load the event", error);
  return data ? fromRow(data as EventRow) : undefined;
}

/**
 * How long the scan path may reuse the last event list. Every scan looks up
 * its session; this keeps the scanner fast while edits still apply within seconds.
 */
const SCAN_CACHE_MS = 5000;

/** The session a pass or scan refers to, or null when the event or session no longer exists. */
export async function findSession(eventId: string, sessionId: string): Promise<SessionMatch | null> {
  let events: BAEvent[];
  if (!supabaseConfigured()) events = memory();
  else {
    const cached = g.__ba_events_cache;
    events = cached && Date.now() - cached.at < SCAN_CACHE_MS ? cached.events : await listEvents();
  }
  const event = events.find((e) => e.id === eventId);
  const session = event?.sessions?.find((s) => s.id === sessionId);
  return event && session ? { event, session } : null;
}

/* ---------------------------------------------------------------- writes */

export async function addEvent(event: BAEvent): Promise<BAEvent> {
  if (!supabaseConfigured()) {
    memory().push(event);
    return event;
  }
  const sb = createAdminClient();
  invalidate();
  const { error } = await sb.from("events").insert({
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category ?? null,
    venue: event.venue,
    start_time: event.start_time,
    end_time: event.end_time,
    organizer_id: null,
    organizer_name: event.organizer_name ?? null,
    organizer_email: event.organizer_id || null,
    status: event.status,
    certificate_enabled: event.certificate_enabled,
    min_attendance_duration_mins: event.min_attendance_duration_mins,
    created_at: event.created_at,
    updated_at: event.updated_at,
  });
  if (error) throw dbError("save the event", error);
  const { error: sessionError } = await sb.from("event_sessions").insert(sessionRows(event.id, event.sessions ?? []));
  if (sessionError) {
    // Never leave an event without its session: undo the insert.
    await sb.from("events").delete().eq("id", event.id);
    throw dbError("save the event's session", sessionError);
  }
  return event;
}

/** Applies changes and bumps `updated_at`. Null when the event no longer exists. */
export async function updateEvent(id: string, changes: EventChanges): Promise<BAEvent | null> {
  const updatedAt = new Date().toISOString();
  const { sessions, ...fields } = changes;
  if (!supabaseConfigured()) {
    const event = memory().find((e) => e.id === id);
    if (!event) return null;
    Object.assign(event, fields, sessions ? { sessions } : {}, { updated_at: updatedAt });
    return event;
  }
  if (!GUID.test(id)) return null;
  const sb = createAdminClient();
  invalidate();
  const { data, error } = await sb.from("events").update({ ...fields, updated_at: updatedAt }).eq("id", id).select("id");
  if (error) throw dbError("save the changes", error);
  if (!data?.length) return null;
  if (sessions?.length) {
    // Same session ids, so passes already issued for the event keep working.
    const { error: sessionError } = await sb.from("event_sessions").upsert(sessionRows(id, sessions));
    if (sessionError) throw dbError("save the session times", sessionError);
  }
  return (await getEvent(id)) ?? null;
}

export function setEventStatus(id: string, status: EventStatus): Promise<BAEvent | null> {
  return updateEvent(id, { status });
}

/** Removes an event and its sessions. Attendance records keep their own copy of the title. */
export async function deleteEvent(id: string): Promise<BAEvent | null> {
  if (!supabaseConfigured()) {
    const list = memory();
    const index = list.findIndex((e) => e.id === id);
    return index < 0 ? null : list.splice(index, 1)[0];
  }
  const existing = await getEvent(id);
  if (!existing) return null;
  invalidate();
  // Its sessions go with it (ON DELETE CASCADE).
  const { data, error } = await createAdminClient().from("events").delete().eq("id", id).select("id");
  if (error) throw dbError("delete the event", error);
  return data?.length ? existing : null;
}
