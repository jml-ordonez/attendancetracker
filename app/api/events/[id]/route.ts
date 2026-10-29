import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deleteEvent, EventStoreError, getEvent, listEvents, setEventStatus, updateEvent } from "@/lib/events/store";
import { duplicateTitle, singleSession } from "@/lib/events/windows";
import { listScans } from "@/lib/attendance/store";
import { logAudit } from "@/lib/audit/store";
import { clientIp, jsonError, parseBody, requireAdmin } from "@/lib/http";
import { ENDED_MESSAGE, eventIdSchema, eventUpdateSchema } from "@/lib/validation";
import type { BAEvent } from "@/types/events";

type Params = { params: Promise<{ id: string }> };

const statusSchema = z.object({ status: z.enum(["published", "draft", "cancelled"], { message: "Choose a valid status." }) });

const VERB = { published: "Published", draft: "Unpublished", cancelled: "Cancelled" } as const;

const NOT_FOUND = "This event no longer exists. It may have been deleted; refresh the list.";

const sameInstant = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

/** Loads the event named in the URL, or the response to send instead. */
async function load(params: Params["params"]): Promise<BAEvent | NextResponse> {
  const { id } = await params;
  if (!eventIdSchema.safeParse(id).success) return jsonError(NOT_FOUND, 404);
  const event = await getEvent(id);
  return event ?? jsonError(NOT_FOUND, 404);
}

function storeFailure(e: unknown, fallback: string) {
  return jsonError(e instanceof EventStoreError ? e.message : fallback, 503);
}

/** Publish, unpublish or cancel. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const parsed = await parseBody(request, statusSchema);
  if ("response" in parsed) return parsed.response;
  const { status } = parsed.data;

  try {
    const current = await load(params);
    if (current instanceof NextResponse) return current;
    if (current.status === status) return NextResponse.json({ event: current });
    if (status === "published" && new Date(current.end_time).getTime() <= Date.now()) {
      return jsonError("This event has already ended, so it can't be published. Edit its date and time first.", 409);
    }

    const event = await setEventStatus(current.id, status);
    if (!event) return jsonError(NOT_FOUND, 404);
    logAudit({
      actor: admin.name,
      actorEmail: admin.email,
      category: "events",
      action: `event.${status}`,
      summary: `${VERB[status]} “${event.title}”`,
      target: event.title,
      outcome: "success",
      ip: clientIp(request),
    });
    return NextResponse.json({ event });
  } catch (e) {
    return storeFailure(e, "Couldn't update the event. Try again.");
  }
}

/**
 * Edits an event's details and schedule, including published ones. The session
 * keeps its id, so passes students already have keep working; scans already
 * recorded are not re-graded.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const parsed = await parseBody(request, eventUpdateSchema);
  if ("response" in parsed) return parsed.response;
  const v = parsed.data;

  try {
    const current = await load(params);
    if (current instanceof NextResponse) return current;

    if (v.expectedUpdatedAt && !sameInstant(v.expectedUpdatedAt, current.updated_at)) {
      return jsonError("Someone else changed this event while you were editing. Close the form and open it again to see the latest version.", 409);
    }

    const start = new Date(v.start);
    const end = new Date(v.end);
    const sessions = current.sessions ?? [];
    const timesChanged = !sameInstant(v.start, current.start_time) || !sameInstant(v.end, current.end_time);
    const graceChanged = sessions.some((s) => s.grace_period_mins !== v.gracePeriodMins);

    if (timesChanged && end.getTime() <= Date.now()) {
      return jsonError(ENDED_MESSAGE, 400, { fieldErrors: { end: ENDED_MESSAGE } });
    }
    if ((timesChanged || graceChanged) && sessions.length > 1) {
      const message = "This event has several sessions, so its schedule can't be changed here. You can still edit the title, venue and description.";
      return jsonError(message, 400, { fieldErrors: { start: message } });
    }
    if (duplicateTitle(await listEvents(), v.title, start, current.id)) {
      const message = "Another event with this title already exists on that date.";
      return jsonError(message, 409, { fieldErrors: { title: message } });
    }

    const changed = [
      v.title !== current.title && "title",
      v.description !== current.description && "description",
      v.venue !== current.venue && "venue",
      timesChanged && "schedule",
      graceChanged && "grace period",
    ].filter(Boolean) as string[];
    if (changed.length === 0) return NextResponse.json({ event: current, changed });

    const event = await updateEvent(current.id, {
      title: v.title,
      description: v.description,
      venue: v.venue,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      ...(timesChanged || graceChanged ? { sessions: [singleSession(current.id, start, end, v.gracePeriodMins, sessions[0])] } : {}),
    });
    if (!event) return jsonError(NOT_FOUND, 404);

    logAudit({
      actor: admin.name,
      actorEmail: admin.email,
      category: "events",
      action: "event.updated",
      summary: `Edited “${event.title}” (${changed.join(", ")})`,
      target: event.title,
      outcome: "success",
      ip: clientIp(request),
      details: { status: event.status, start: event.start_time, ...(current.title !== event.title ? { previousTitle: current.title } : {}) },
    });
    return NextResponse.json({ event, changed });
  } catch (e) {
    return storeFailure(e, "Couldn't save the changes. Try again.");
  }
}

/**
 * Deletes an event. Its attendance records are kept (they carry the event's
 * title) so reports stay complete; passes for it stop working.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { id } = await params;
    if (!eventIdSchema.safeParse(id).success) return jsonError("This event was already deleted. Refresh the list.", 404);
    const event = await deleteEvent(id);
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
  } catch (e) {
    return storeFailure(e, "Couldn't delete the event. Try again.");
  }
}
