import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { validateTokenIntegrity } from "@/lib/tokens/qr-token";
import { recordAttendance } from "@/lib/attendance/record";
import { findSession } from "@/lib/events/store";
import { logAudit } from "@/lib/audit/store";
import { clientIp, parseBody, requireAdmin } from "@/lib/http";
import { purposeSchema } from "@/lib/validation";
import type { ScanVerificationResult } from "@/types/qr";

const schema = z.object({
  token: z.string().min(1).max(4000),
  eventId: z.string().min(1),
  sessionId: z.string().min(1),
  /** Optional: the scanner now leaves it out and the pass decides time-in or time-out. */
  expectedPurpose: purposeSchema.optional(),
});

const REJECTIONS = {
  INVALID_TOKEN: ["TOKEN_TAMPERED", "This is not a valid attendance pass."],
  TOKEN_EXPIRED: ["TOKEN_EXPIRED", "This pass has expired. Ask the student to reopen their pass to get a new code."],
  PURPOSE_MISMATCH: ["TOKEN_INVALID", "Wrong pass type for this scanner. Ask the student to switch their pass to match."],
  EVENT_MISMATCH: ["TOKEN_INVALID", "This pass is for a different event."],
  SESSION_MISMATCH: ["TOKEN_INVALID", "This pass is for a different session of this event."],
} as const;

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const { token, eventId, sessionId, expectedPurpose } = parsed.data;
  const ip = clientIp(request);

  // Decrypt, check the HMAC, expiry, event and session in one place.
  const check = validateTokenIntegrity(token, undefined, eventId, sessionId);
  const p = check.payload;

  let result: ScanVerificationResult;
  if (!check.valid || !p) {
    const [status, message] = REJECTIONS[check.errorCode ?? "INVALID_TOKEN"];
    result = {
      success: false,
      status,
      message,
      timestamp: new Date().toISOString(),
      details: p?.sname ? { studentName: p.sname, studentIdNumber: p.snum } : undefined,
    };
  } else if (!p.sname || !p.snum || !p.smaj || !p.ssec) {
    result = {
      success: false,
      status: "TOKEN_INVALID",
      message: "This pass was made by an older version of the app. Ask the student to reopen their pass.",
      timestamp: new Date().toISOString(),
    };
  } else {
    const found = await findSession(eventId, sessionId);
    result = recordAttendance({
      student: { name: p.sname, idNumber: p.snum, majorCode: p.smaj, section: p.ssec },
      eventId,
      sessionId,
      found,
      // One pass serves time-in and time-out, so it is not single-use; the
      // duplicate checks in recordAttendance stop a second time-in or time-out.
      purpose: p.p === "attendance" ? "attendance" : (expectedPurpose ?? p.p),
      officer: admin.name,
      method: "qr",
    });
  }

  const who = result.details?.studentName ? `${result.details.studentName} (${result.details.studentIdNumber})` : "unknown pass";
  logAudit({
    actor: admin.name,
    actorEmail: admin.email,
    category: "attendance",
    action: result.success ? "scan.verified" : "scan.rejected",
    summary: result.success
      ? `${result.details?.action === "time_out" ? "Timed out" : "Timed in"} ${who}`
      : `Rejected scan of ${who}: ${result.message}`,
    target: result.details?.eventTitle,
    outcome: result.success ? "success" : "failure",
    ip,
    details: { status: result.status },
  });

  // Strip the internal scan record from the response.
  const { success, status, message, timestamp, details } = result;
  return NextResponse.json({ success, status, message, timestamp, details } satisfies ScanVerificationResult);
}
