import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { recordAttendance } from "@/lib/attendance/record";
import { findScan } from "@/lib/attendance/store";
import { logAudit } from "@/lib/audit/store";
import { clientIp, jsonError, parseBody, requireAdmin } from "@/lib/http";
import {
  deriveMajorFromSection,
  majorCodeSchema,
  personNameSchema,
  purposeSchema,
  reasonSchema,
  sectionMatchesMajor,
  sectionSchema,
  studentIdSchema,
} from "@/lib/validation";

const schema = z
  .object({
    eventId: z.string().min(1),
    sessionId: z.string().min(1),
    purpose: purposeSchema,
    studentIdNumber: studentIdSchema,
    reason: reasonSchema,
    // Needed only for a time-in; a time-out reuses the identity from the time-in.
    studentName: personNameSchema.optional(),
    /** Optional: derived from the section when left out. */
    majorCode: majorCodeSchema.optional(),
    section: sectionSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.purpose !== "time_in") return;
    if (!v.studentName) ctx.addIssue({ code: "custom", path: ["studentName"], message: "Enter the student's full name." });
    if (!v.section) ctx.addIssue({ code: "custom", path: ["section"], message: "Select the student's section." });
    else if (v.majorCode && !sectionMatchesMajor(v.section, v.majorCode))
      ctx.addIssue({ code: "custom", path: ["section"], message: "The section doesn't belong to the chosen program." });
  });

/**
 * Manual entry when a pass can't be scanned (broken screen, dead battery).
 * The old route required a Supabase user that the staff demo session never
 * had, so it returned 401 every time.
 */
export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const v = parsed.data;

  let student;
  if (v.purpose === "time_in") {
    student = { name: v.studentName!, idNumber: v.studentIdNumber, majorCode: v.majorCode ?? deriveMajorFromSection(v.section!), section: v.section! };
  } else {
    const timeIn = findScan(v.studentIdNumber, v.sessionId, "time_in");
    if (!timeIn) return jsonError(`No time-in on record for ${v.studentIdNumber} in this session.`, 404, { fieldErrors: { studentIdNumber: "No time-in on record for this ID in this session." } });
    student = { name: timeIn.studentName, idNumber: v.studentIdNumber, majorCode: timeIn.majorCode, section: timeIn.section };
  }

  const result = recordAttendance({
    student,
    eventId: v.eventId,
    sessionId: v.sessionId,
    purpose: v.purpose,
    officer: admin.name,
    method: "manual",
  });

  logAudit({
    actor: admin.name,
    actorEmail: admin.email,
    category: "attendance",
    action: result.success ? "manual_entry.recorded" : "manual_entry.rejected",
    summary: result.success
      ? `Manual ${v.purpose === "time_in" ? "time-in" : "time-out"} for ${student.name} (${student.idNumber})`
      : `Manual entry for ${student.idNumber} rejected: ${result.message}`,
    target: result.details?.eventTitle,
    outcome: result.success ? "success" : "failure",
    ip: clientIp(request),
    details: { reason: v.reason, status: result.status },
  });

  if (!result.success) return jsonError(result.message, 409);
  return NextResponse.json({ success: true, message: result.message, studentName: student.name, details: result.details });
}
