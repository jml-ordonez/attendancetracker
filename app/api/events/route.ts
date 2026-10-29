import { NextResponse, type NextRequest } from "next/server";
import { addEvent, listEvents } from "@/lib/events/store";
import { logAudit } from "@/lib/audit/store";
import { clientIp, getAdmin, jsonError, parseBody, requireAdmin } from "@/lib/http";
import { eventInputSchema } from "@/lib/validation";
import type { BAEvent } from "@/types/events";

/** Published events for students; every event for signed-in staff. */
export async function GET(request: NextRequest) {
  const admin = getAdmin(request);
  const events = listEvents().filter((e) => admin || e.status === "published");
  return NextResponse.json({ events, serverTime: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const parsed = await parseBody(request, eventInputSchema);
  if ("response" in parsed) return parsed.response;
  const v = parsed.data;

  const start = new Date(v.start);
  const end = new Date(v.end);
  // Compare calendar days in Philippine time, not UTC (an 07:00 event would land on the previous UTC day).
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const duplicate = listEvents().some(
    (e) => e.title.toLowerCase() === v.title.toLowerCase() && day(new Date(e.start_time)) === day(start)
  );
  if (duplicate) {
    return jsonError("An event with this title already exists on that date.", 409, { fieldErrors: { title: "An event with this title already exists on that date." } });
  }

  // The time-in window is the first hour and the time-out window the last hour,
  // shortened for short events so the two windows never overlap.
  const windowMs = Math.min(60, Math.floor((end.getTime() - start.getTime()) / 60000 / 2)) * 60000;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const event: BAEvent = {
    id,
    title: v.title,
    description: v.description,
    venue: v.venue,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    organizer_id: admin.email,
    organizer_name: admin.name,
    status: v.publish ? "published" : "draft",
    certificate_enabled: true,
    // No minimum stay: a certificate needs a time-in and an on-time time-out.
    min_attendance_duration_mins: 0,
    created_at: now,
    updated_at: now,
    sessions: [
      {
        id: crypto.randomUUID(),
        event_id: id,
        title: "Main session",
        session_date: day(start),
        time_in_start: start.toISOString(),
        time_in_end: new Date(start.getTime() + windowMs).toISOString(),
        time_out_start: new Date(end.getTime() - windowMs).toISOString(),
        time_out_end: end.toISOString(),
        grace_period_mins: v.gracePeriodMins,
        order_index: 1,
      },
    ],
  };
  addEvent(event);

  logAudit({
    actor: admin.name,
    actorEmail: admin.email,
    category: "events",
    action: "event.created",
    summary: `Created ${v.publish ? "and published " : ""}“${event.title}”`,
    target: event.title,
    outcome: "success",
    ip: clientIp(request),
    details: { venue: event.venue, start: event.start_time },
  });

  return NextResponse.json({ event }, { status: 201 });
}
