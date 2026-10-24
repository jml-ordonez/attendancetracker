import { AttendanceClassification } from "@/types/events";

export interface SessionSchedule {
  timeInStart: Date;
  timeInEnd: Date;
  timeOutStart: Date;
  timeOutEnd: Date;
  gracePeriodMins: number;
}

export interface AttendanceEvaluationResult {
  isLate: boolean;
  timeInClassification: "on_time" | "late";
  isEarlyDeparture: boolean;
  timeOutClassification: "normal" | "early_departure";
  durationMinutes: number;
  finalClassification: AttendanceClassification;
}

/**
 * Calculates attendance status based on server timestamps, grace periods, and schedule.
 */
export function evaluateAttendance(
  timeIn: Date | null,
  timeOut: Date | null,
  schedule: SessionSchedule,
  isExcused = false
): AttendanceEvaluationResult {
  if (isExcused) {
    return {
      isLate: false,
      timeInClassification: "on_time",
      isEarlyDeparture: false,
      timeOutClassification: "normal",
      durationMinutes: 0,
      finalClassification: "excused",
    };
  }

  // If no time-in was ever recorded
  if (!timeIn) {
    return {
      isLate: false,
      timeInClassification: "on_time",
      isEarlyDeparture: false,
      timeOutClassification: "normal",
      durationMinutes: 0,
      finalClassification: "absent",
    };
  }

  // Grace Period Cutoff Calculation
  const gracePeriodMs = schedule.gracePeriodMins * 60000;
  const lateCutoff = new Date(schedule.timeInStart.getTime() + gracePeriodMs);
  const isLate = timeIn.getTime() > lateCutoff.getTime();
  const timeInClassification = isLate ? "late" : "on_time";

  // If time-out not recorded yet
  if (!timeOut) {
    return {
      isLate,
      timeInClassification,
      isEarlyDeparture: false,
      timeOutClassification: "normal",
      durationMinutes: 0,
      finalClassification: isLate ? "late" : "present",
    };
  }

  // Early Departure Calculation
  const isEarlyDeparture = timeOut.getTime() < schedule.timeOutStart.getTime();
  const timeOutClassification = isEarlyDeparture ? "early_departure" : "normal";

  // Duration in verified minutes
  const durationMinutes = Math.max(0, Math.round((timeOut.getTime() - timeIn.getTime()) / 60000));

  let finalClassification: AttendanceClassification;
  if (isEarlyDeparture) {
    finalClassification = "left_early";
  } else if (isLate) {
    finalClassification = "late";
  } else {
    finalClassification = "checked_out";
  }

  return {
    isLate,
    timeInClassification,
    isEarlyDeparture,
    timeOutClassification,
    durationMinutes,
    finalClassification,
  };
}

export interface CertificateEligibilityCheck {
  eligible: boolean;
  reason?: string;
  verifiedHours: number;
}

/**
 * Evaluates whether a student meets requirements for an event certificate.
 */
export function checkCertificateEligibility(
  records: {
    durationMinutes: number;
    finalStatus: AttendanceClassification;
    sessionId: string;
  }[],
  requiredSessionIds: string[],
  minTotalDurationMins: number
): CertificateEligibilityCheck {
  const attendedSessionIds = new Set(
    records
      .filter((r) => ["checked_out", "on_time", "late", "excused"].includes(r.finalStatus))
      .map((r) => r.sessionId)
  );

  // Check required sessions
  for (const reqSession of requiredSessionIds) {
    if (!attendedSessionIds.has(reqSession)) {
      return {
        eligible: false,
        reason: "Missed one or more required event sessions.",
        verifiedHours: 0,
      };
    }
  }

  // Total verified minutes
  const totalMinutes = records.reduce((sum, r) => sum + (r.durationMinutes || 0), 0);
  const verifiedHours = Number((totalMinutes / 60).toFixed(2));

  if (totalMinutes < minTotalDurationMins) {
    return {
      eligible: false,
      reason: `Insufficient attendance duration. Required: ${minTotalDurationMins} mins, Verified: ${totalMinutes} mins.`,
      verifiedHours,
    };
  }

  return {
    eligible: true,
    verifiedHours,
  };
}
