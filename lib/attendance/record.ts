import type { ScanVerificationResult, TokenPurpose } from "@/types/qr";
import type { AttendanceScan } from "@/types/attendance";
import { evaluateAttendance } from "@/lib/rules/attendance-rules";
import type { SessionMatch } from "@/lib/events/store";
import { addScan, consumeToken, findScan } from "@/lib/attendance/store";

/** How early before the time-in window a student may time in. */
export const CHECK_IN_OPENS_EARLY_MINS = 60;

/**
 * With one pass for time-in and time-out, a second scan this soon after
 * timing in is treated as a repeat at the door, not a time-out.
 */
export const MIN_MINS_BEFORE_CHECKOUT = 5;

const TIME_ZONE = process.env.APP_TIMEZONE || "Asia/Manila";

/** Server-side clock text for messages, in the department's time zone (not the server's). */
export function clockTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE }).format(
    new Date(iso)
  );
}

function clockDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export interface ScanStudent {
  name: string;
  idNumber: string;
  majorCode: string;
  section: string;
}

export interface RecordAttendanceInput {
  student: ScanStudent;
  eventId: string;
  sessionId: string;
  /** The event and session, looked up by the caller (`findSession`); null when they no longer exist. */
  found: SessionMatch | null;
  purpose: TokenPurpose;
  officer: string;
  method: "qr" | "manual";
  /** Present for QR scans: enforces single use. */
  token?: { id: string; expiresAt: number };
  now?: Date;
}

export type RecordAttendanceResult = ScanVerificationResult & { scan?: AttendanceScan };

function fail(status: ScanVerificationResult["status"], message: string, student?: ScanStudent): RecordAttendanceResult {
  return {
    success: false,
    status,
    message,
    timestamp: new Date().toISOString(),
    details: student ? { studentName: student.name, studentIdNumber: student.idNumber } : undefined,
  };
}

/**
 * The single attendance pipeline for QR scans and manual entries: checks the
 * session is open, rejects reused tokens and duplicate scans, classifies the
 * scan (on time / late, timed out / left early) from the session's schedule
 * and grace period, and records it.
 *
 * Synchronous on purpose: with no awaits between the duplicate check and the
 * insert, two scans of the same pass cannot both get through. That is why the
 * caller looks the session up (async) and passes it in.
 */
export function recordAttendance(input: RecordAttendanceInput): RecordAttendanceResult {
  const { student, officer, method } = input;
  const now = input.now ?? new Date();

  // One pass for both: time in if there is no time-in yet, otherwise time out.
  let purpose = input.purpose;
  if (purpose === "attendance") {
    const timeIn = findScan(student.idNumber, input.sessionId, "time_in");
    const timeOut = findScan(student.idNumber, input.sessionId, "time_out");
    if (timeIn && timeOut) {
      return fail(
        "DUPLICATE_SCAN",
        `${timeIn.studentName} has already completed attendance: timed in at ${clockTime(timeIn.timestamp)} and out at ${clockTime(timeOut.timestamp)}.`,
        student
      );
    }
    if (timeIn && now.getTime() - new Date(timeIn.timestamp).getTime() < MIN_MINS_BEFORE_CHECKOUT * 60000) {
      return fail(
        "DUPLICATE_SCAN",
        `${timeIn.studentName} already timed in at ${clockTime(timeIn.timestamp)}. Scan the same pass again when leaving to time out.`,
        student
      );
    }
    purpose = timeIn ? "time_out" : "time_in";
  }

  if (purpose !== "time_in" && purpose !== "time_out") {
    return fail("TOKEN_INVALID", "This pass type is not accepted at the door.", student);
  }

  const { found } = input;
  if (!found || found.event.id !== input.eventId || found.session.id !== input.sessionId) return fail("SESSION_NOT_FOUND", "This event session no longer exists.", student);
  const { event, session } = found;

  if (event.status !== "published") {
    return fail("WINDOW_CLOSED", "This event is not published, so attendance is closed.", student);
  }

  const opensAt = new Date(new Date(session.time_in_start).getTime() - CHECK_IN_OPENS_EARLY_MINS * 60000);
  const endsAt = new Date(session.time_out_end);

  if (purpose === "time_in") {
    if (now < opensAt) {
      return fail("WINDOW_CLOSED", `Time-in opens at ${clockDateTime(opensAt.toISOString())}.`, student);
    }
    if (now > endsAt) {
      return fail("WINDOW_CLOSED", `This session ended at ${clockTime(endsAt)}. Time-in is closed.`, student);
    }
  }

  const timeIn = findScan(student.idNumber, session.id, "time_in");
  const timeOut = findScan(student.idNumber, session.id, "time_out");

  if (purpose === "time_in" && timeIn) {
    return fail("DUPLICATE_SCAN", `${student.name} already timed in at ${clockTime(timeIn.timestamp)}.`, student);
  }
  if (purpose === "time_out") {
    if (!timeIn) return fail("STUDENT_INELIGIBLE", "No time-in on record for this session, so there is nothing to time out.", student);
    if (timeOut) {
      return fail("DUPLICATE_SCAN", `${student.name} already timed out at ${clockTime(timeOut.timestamp)}.`, student);
    }
  }

  if (input.token && !consumeToken(input.token.id, input.token.expiresAt)) {
    return fail("DUPLICATE_TOKEN_USE", "This code was already used. Ask the student to show the new code on their screen.", student);
  }

  const schedule = {
    timeInStart: new Date(session.time_in_start),
    timeInEnd: new Date(session.time_in_end),
    timeOutStart: new Date(session.time_out_start),
    timeOutEnd: new Date(session.time_out_end),
    gracePeriodMins: session.grace_period_mins,
  };

  const common = {
    studentName: student.name,
    studentIdNumber: student.idNumber,
    majorCode: student.majorCode,
    section: student.section,
    eventId: event.id,
    eventTitle: event.title,
    sessionId: session.id,
    sessionTitle: session.title,
    method,
    officer,
    timestamp: now.toISOString(),
  };

  if (purpose === "time_in") {
    const result = evaluateAttendance(now, null, schedule);
    const scan = addScan({ ...common, action: "time_in", status: result.isLate ? "late" : "on_time" });
    return {
      success: true,
      status: result.isLate ? "SUCCESS_LATE" : "SUCCESS_ON_TIME",
      message: result.isLate
        ? `Timed in late. The grace period ended at ${clockTime(new Date(schedule.timeInStart.getTime() + session.grace_period_mins * 60000))}.`
        : "Timed in on time.",
      timestamp: scan.timestamp,
      details: {
        studentName: student.name,
        studentIdNumber: student.idNumber,
        eventTitle: event.title,
        sessionTitle: session.title,
        action: "time_in",
        timeIn: scan.timestamp,
        isLate: result.isLate,
      },
      scan,
    };
  }

  const result = evaluateAttendance(new Date(timeIn!.timestamp), now, schedule);
  const scan = addScan({
    ...common,
    // Keep the identity from the time-in scan so a manual time-out can't rename the student.
    studentName: timeIn!.studentName,
    majorCode: timeIn!.majorCode,
    section: timeIn!.section,
    action: "time_out",
    status: result.isEarlyDeparture ? "left_early" : "checked_out",
    durationMinutes: result.durationMinutes,
  });
  return {
    success: true,
    status: result.isEarlyDeparture ? "SUCCESS_CHECKOUT_EARLY" : "SUCCESS_CHECKOUT",
    message: result.isEarlyDeparture
      ? `Timed out before ${clockTime(schedule.timeOutStart)}: recorded as left early.`
      : "Timed out.",
    timestamp: scan.timestamp,
    details: {
      studentName: timeIn!.studentName,
      studentIdNumber: student.idNumber,
      eventTitle: event.title,
      sessionTitle: session.title,
      action: "time_out",
      timeIn: timeIn!.timestamp,
      timeOut: scan.timestamp,
      durationMinutes: result.durationMinutes,
      isEarlyDeparture: result.isEarlyDeparture,
    },
    scan,
  };
}
