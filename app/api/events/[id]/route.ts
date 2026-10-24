import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getEvent, setEventStatus } from "@/lib/events/store";
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
