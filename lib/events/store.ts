import type { BAEvent, EventSession, EventStatus } from "@/types/events";

/**
 * Department events and their sessions.
 *
 * Previously the event list lived in the dashboard's React state, so an event
 * created in "Manage events" vanished on reload and never reached the scanner
 * or the student pass. It now lives on the server next to the attendance store.
 * Seed times are in Philippine time (UTC+8).
 */

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

const g = globalThis as unknown as { __ba_events?: BAEvent[] };
if (!g.__ba_events) g.__ba_events = structuredClone(SEED);

const time = (iso: string) => new Date(iso).getTime();

export function listEvents(): BAEvent[] {
  return [...g.__ba_events!].sort((a, b) => time(a.start_time) - time(b.start_time));
}

export function getEvent(id: string): BAEvent | undefined {
  return g.__ba_events!.find((e) => e.id === id);
}

export function findSession(eventId: string, sessionId: string): { event: BAEvent; session: EventSession } | null {
  const event = getEvent(eventId);
  const session = event?.sessions?.find((s) => s.id === sessionId);
  return event && session ? { event, session } : null;
}

export function addEvent(event: BAEvent): BAEvent {
  g.__ba_events!.push(event);
  return event;
}

export function setEventStatus(id: string, status: EventStatus): BAEvent | null {
  const event = getEvent(id);
  if (!event) return null;
  event.status = status;
  event.updated_at = new Date().toISOString();
  return event;
}
