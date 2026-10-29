import { NextResponse, type NextRequest } from "next/server";
import { addEvent, EventStoreError, listEvents } from "@/lib/events/store";
import { duplicateTitle, singleSession } from "@/lib/events/windows";
import { logAudit } from "@/lib/audit/store";
import { clientIp, getAdmin, jsonError, parseBody, requireAdmin } from "@/lib/http";
import { eventInputSchema } from "@/lib/validation";

/** Published events for students; every event for signed-in staff. Never cached: lists must reflect deletes at once. */
export async function GET(request: NextRequest) {
  const admin = getAdmin(request);
  try {
    const events = (await listEvents()).filter((e) => admin || e.status === "published");
    return NextResponse.json({ events, serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return jsonError(e instanceof EventStoreError ? e.message : "Couldn't load the events.", 503);
  }
}

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const parsed = await parseBody(request, eventInputSchema);
  if ("response" in parsed) return parsed.response;
  const v = parsed.data;
  const start = new Date(v.start);
  const end = new Date(v.end);

  try {
    if (duplicateTitle(await listEvents(), v.title, start)) {
      const message = "An event with this title already exists on that date.";
      return jsonError(message, 409, { fieldErrors: { title: message } });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const event = await addEvent({
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
      sessions: [singleSession(id, start, end, v.gracePeriodMins)],
    });

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
  } catch (e) {
    return jsonError(e instanceof EventStoreError ? e.message : "Couldn't save the event. Try again.", 503);
  }
}
