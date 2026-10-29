import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deleteEvent, getEvent, setEventStatus } from "@/lib/events/store";
import { listScans } from "@/lib/attendance/store";
import { logAudit } from "@/lib/audit/store";
import { clientIp, jsonError, parseBody, requireAdmin } from "@/lib/http";

const schema = z.object({ status: z.enum(["published", "draft", "cancelled"]) });

const VERB = { published: "Published", draft: "Unpublished", cancelled: "Cancelled" } as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!getEvent(id)) return jsonError("Event not found.", 404);

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  const event = setEventStatus(id, parsed.data.status)!;
  logAudit({
    actor: admin.name,
    actorEmail: admin.email,
    category: "events",
    action: `event.${parsed.data.status}`,
    summary: `${VERB[parsed.data.status]} “${event.title}”`,
    target: event.title,
    outcome: "success",
    ip: clientIp(request),
  });
  return NextResponse.json({ event });
}

/**
 * Deletes an event. Its attendance records are kept (they carry the event's
 * title) so reports stay complete; passes for it stop working.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const event = deleteEvent(id);
  if (!event) return jsonError("This event was already deleted. Refresh the list.", 404);

  const records = listScans().filter((s) => s.eventId === id).length;
  logAudit({
    actor: admin.name,
    actorEmail: admin.email,
    category: "events",
    action: "event.deleted",
    summary: `Deleted “${event.title}”`,
    target: event.title,
    outcome: "success",
    ip: clientIp(request),
    details: { status: event.status, start: event.start_time, recordsKept: records },
  });
  return NextResponse.json({ deleted: event.id, recordsKept: records });
}
