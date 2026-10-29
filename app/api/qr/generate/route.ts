import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateStudentQRToken } from "@/lib/tokens/qr-token";
import { findSession } from "@/lib/events/store";
import { jsonError, parseBody } from "@/lib/http";
import { majorCodeSchema, personNameSchema, sectionSchema, studentIdSchema } from "@/lib/validation";

/**
 * How long a pass stays valid after its session ends. The pass no longer
 * rotates: one code (on screen or downloaded) serves time-in and time-out,
 * and the scanner still enforces the session's attendance windows.
 */
const VALID_AFTER_SESSION_SECONDS = 7 * 24 * 60 * 60;

const schema = z.object({
  eventId: z.string().min(1),
  sessionId: z.string().min(1),
  student: z.object({
    name: personNameSchema,
    idNumber: studentIdSchema,
    majorCode: majorCodeSchema,
    section: sectionSchema,
  }),
});

/**
 * Issues the encrypted pass for one session. Public: students have no accounts.
 */
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const { eventId, sessionId, student } = parsed.data;

  const found = await findSession(eventId, sessionId);
  if (!found || found.event.status !== "published") {
    return jsonError("This event is no longer open for attendance. Choose another event.", 404);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const sessionEndSec = Math.floor(new Date(found.session.time_out_end).getTime() / 1000);
  if (sessionEndSec < nowSec) {
    return jsonError("This event has ended. Choose another event.", 410);
  }
  const expirySeconds = Math.max(sessionEndSec - nowSec, 0) + VALID_AFTER_SESSION_SECONDS;

  const token = generateStudentQRToken({
    studentId: student.idNumber,
    studentName: student.name,
    studentIdNumber: student.idNumber,
    majorCode: student.majorCode,
    section: student.section,
    eventId,
    sessionId,
    purpose: "attendance",
    expirySeconds,
  });

  return NextResponse.json({
    token: token.token,
    expiresAt: token.expiresAt * 1000,
  });
}
