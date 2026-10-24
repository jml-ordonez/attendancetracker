import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateStudentQRToken } from "@/lib/tokens/qr-token";
import { findSession } from "@/lib/events/store";
import { jsonError, parseBody } from "@/lib/http";
import { majorCodeSchema, personNameSchema, purposeSchema, sectionSchema, studentIdSchema } from "@/lib/validation";

const EXPIRY_SECONDS = Number(process.env.NEXT_PUBLIC_QR_EXPIRY_SECONDS) || 45;

const schema = z.object({
  eventId: z.string().min(1),
  sessionId: z.string().min(1),
  purpose: purposeSchema,
  student: z.object({
    name: personNameSchema,
    idNumber: studentIdSchema,
    majorCode: majorCodeSchema,
    section: sectionSchema,
  }),
});

/**
 * Issues a short-lived encrypted pass. Public: students have no accounts.
 * The old route also called Supabase auth and inserted into the token registry
 * on every refresh; both always failed for locally registered students and
 * added a network round trip to each 45-second rotation.
 */
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const { eventId, sessionId, purpose, student } = parsed.data;

  const found = findSession(eventId, sessionId);
  if (!found || found.event.status !== "published") {
    return jsonError("This event is no longer open for attendance. Choose another event.", 404);
  }

  const token = generateStudentQRToken({
    studentId: student.idNumber,
    studentName: student.name,
    studentIdNumber: student.idNumber,
    majorCode: student.majorCode,
    section: student.section,
    eventId,
    sessionId,
    purpose,
    expirySeconds: EXPIRY_SECONDS,
  });

  return NextResponse.json({
    token: token.token,
    purpose,
    expiresAt: token.expiresAt * 1000,
    serverTime: Date.now(),
    expirySeconds: EXPIRY_SECONDS,
  });
}
