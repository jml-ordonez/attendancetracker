import { NextResponse, type NextRequest } from "next/server";
import { listScans } from "@/lib/attendance/store";
import { buildRoll } from "@/lib/attendance/roll";
import { generateAttendanceCSV, type CSVAttendanceRow } from "@/lib/export/csv-generator";
import { logAudit } from "@/lib/audit/store";
import { clientIp, requireAdmin } from "@/lib/http";
import { MAJORS } from "@/lib/validation";

const TIME_ZONE = process.env.APP_TIMEZONE || "Asia/Manila";
const stamp = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });

/**
 * One row per student per session (time-in and time-out paired), filtered like
 * the Records screen. Previously this required a Supabase user the staff session
 * never had, so the download saved a JSON error instead of a CSV.
 */
export async function GET(request: NextRequest) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const sp = request.nextUrl.searchParams;
  const eventId = sp.get("eventId");
  const status = sp.get("status");
  const major = sp.get("major");
  const q = sp.get("q")?.trim().toLowerCase();

  const roll = buildRoll(listScans()).filter(
    (r) =>
      (!eventId || r.eventId === eventId) &&
      (!status || r.finalStatus === status) &&
      (!major || r.majorCode === major) &&
      (!q || r.studentName.toLowerCase().includes(q) || r.studentIdNumber.toLowerCase().includes(q))
  );

  const rows: CSVAttendanceRow[] = roll.map((r) => ({
    studentIdNumber: r.studentIdNumber,
    studentName: r.studentName,
    major: MAJORS[r.majorCode] ?? r.majorCode,
    yearLevel: r.section.match(/ (\d)-/)?.[1] ?? "",
    section: r.section,
    eventTitle: r.eventTitle,
    sessionTitle: r.sessionTitle,
    timeIn: r.timeIn ? stamp.format(new Date(r.timeIn)) : "",
    timeOut: r.timeOut ? stamp.format(new Date(r.timeOut)) : "",
    durationMinutes: r.durationMinutes,
    timeInStatus: r.timeInStatus?.replace("_", " ") ?? "",
    timeOutStatus: r.timeOut ? (r.finalStatus === "left_early" ? "left early" : "normal") : "",
    finalStatus: r.finalStatus.replace("_", " ") + (r.correction ? ` (corrected: ${r.correction.reason})` : ""),
  }));

  logAudit({
    actor: admin.name,
    actorEmail: admin.email,
    category: "reports",
    action: "report.exported",
    summary: `Exported attendance CSV (${rows.length} row${rows.length === 1 ? "" : "s"})`,
    outcome: "success",
    ip: clientIp(request),
    details: { eventId, status, major },
  });

  const filename = `BA_Attendance_${new Date().toISOString().slice(0, 10)}.csv`;
  // BOM so Excel opens UTF-8 names (ñ, é) correctly.
  return new NextResponse("﻿" + generateAttendanceCSV(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
