import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { addEvent, listEvents } from "@/lib/events/store";
import { logAudit } from "@/lib/audit/store";
import { clientIp, getAdmin, jsonError, parseBody, requireAdmin } from "@/lib/http";
import type { BAEvent } from "@/types/events";

/** Published events for students; every event for signed-in staff. */
export async function GET(request: NextRequest) {
  const admin = getAdmin(request);
  const events = listEvents().filter((e) => admin || e.status === "published");
  return NextResponse.json({ events, serverTime: new Date().toISOString() });
}

const CATEGORIES = ["Seminar", "Lecture", "Workshop", "Conference", "Meeting", "General Assembly"] as const;

const schema = z
  .object({
    title: z.string().trim().min(5, "Use a descriptive title of at least 5 characters.").max(120, "Keep the title under 120 characters."),
    description: z.string().trim().min(10, "Add a short description (at least 10 characters).").max(500, "Keep the description under 500 characters."),
    category: z.enum(CATEGORIES, { message: "Choose a category." }),
    venue: z.string().trim().min(3, "Enter a venue.").max(120, "Keep the venue under 120 characters."),
    start: z.iso.datetime({ offset: true, message: "Choose a start date and time." }),
    end: z.iso.datetime({ offset: true, message: "Choose an end date and time." }),
    sessionTitle: z.string().trim().min(3, "Name the session.").max(120),
    gracePeriodMins: z.number().int("Enter whole minutes.").min(0, "Use 0 to 120 minutes.").max(120, "Use 0 to 120 minutes."),
    minDurationMins: z.number().int("Enter whole minutes.").min(1, "Enter at least 1 minute."),
    publish: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const start = new Date(v.start).getTime();
    const end = new Date(v.end).getTime();
    if (end <= start) ctx.addIssue({ code: "custom", path: ["end"], message: "The end must be after the start." });
    else if (end - start > 24 * 60 * 60 * 1000) ctx.addIssue({ code: "custom", path: ["end"], message: "Split events longer than a day into separate events." });
    if (start < Date.now() - 24 * 60 * 60 * 1000) ctx.addIssue({ code: "custom", path: ["start"], message: "The start can't be in the past." });
    if (v.minDurationMins > (end - start) / 60000) ctx.addIssue({ code: "custom", path: ["minDurationMins"], message: "This is longer than the event itself." });
  });

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const v = parsed.data;

  const start = new Date(v.start);
  const end = new Date(v.end);
  const duplicate = listEvents().some(
    (e) =>
      e.title.toLowerCase() === v.title.toLowerCase() &&
      new Date(e.start_time).toISOString().slice(0, 10) === start.toISOString().slice(0, 10)
  );
  if (duplicate) {
    return jsonError("An event with this title already exists on that date.", 409, { fieldErrors: { title: "An event with this title already exists on that date." } });
  }

  // The check-in window is the first hour and the check-out window the last hour,
  // shortened for short events so the two windows never overlap.
  const windowMs = Math.min(60, Math.floor((end.getTime() - start.getTime()) / 60000 / 2)) * 60000;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const event: BAEvent = {
    id,
    title: v.title,
    description: v.description,
    category: v.category,
    venue: v.venue,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    organizer_id: admin.email,
    organizer_name: admin.name,
    status: v.publish ? "published" : "draft",
    certificate_enabled: true,
    min_attendance_duration_mins: v.minDurationMins,
    created_at: now,
    updated_at: now,
    sessions: [
      {
        id: crypto.randomUUID(),
        event_id: id,
        title: v.sessionTitle,
        session_date: v.start.slice(0, 10),
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
