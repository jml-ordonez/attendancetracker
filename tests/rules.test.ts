import { describe, it, expect } from "vitest";
import { evaluateAttendance, checkCertificateEligibility, SessionSchedule } from "../lib/rules/attendance-rules";

describe("Attendance Rules Engine & Certificate Eligibility", () => {
  const baseSchedule: SessionSchedule = {
    timeInStart: new Date("2026-10-23T08:00:00Z"),
    timeInEnd: new Date("2026-10-23T09:00:00Z"),
    timeOutStart: new Date("2026-10-23T12:00:00Z"),
    timeOutEnd: new Date("2026-10-23T13:00:00Z"),
    gracePeriodMins: 15,
  };

  it("should classify time-in within grace period as on_time", () => {
    // 8:10 AM is within 15 mins grace period (cutoff 8:15 AM)
    const timeIn = new Date("2026-10-23T08:10:00Z");
    const timeOut = new Date("2026-10-23T12:05:00Z");

    const result = evaluateAttendance(timeIn, timeOut, baseSchedule);

    expect(result.isLate).toBe(false);
    expect(result.timeInClassification).toBe("on_time");
    expect(result.isEarlyDeparture).toBe(false);
    expect(result.finalClassification).toBe("checked_out");
    expect(result.durationMinutes).toBe(235); // 3 hours 55 minutes
  });

  it("should classify time-in after grace period as late", () => {
    // 8:20 AM is 5 minutes past the 8:15 AM cutoff
    const timeIn = new Date("2026-10-23T08:20:00Z");
    const timeOut = new Date("2026-10-23T12:00:00Z");

    const result = evaluateAttendance(timeIn, timeOut, baseSchedule);

    expect(result.isLate).toBe(true);
    expect(result.timeInClassification).toBe("late");
    expect(result.finalClassification).toBe("late");
  });

  it("should detect early departure when time-out occurs before timeOutStart", () => {
    const timeIn = new Date("2026-10-23T08:00:00Z");
    // Leaves at 11:30 AM (before 12:00 PM timeOutStart)
    const timeOut = new Date("2026-10-23T11:30:00Z");

    const result = evaluateAttendance(timeIn, timeOut, baseSchedule);

    expect(result.isEarlyDeparture).toBe(true);
    expect(result.timeOutClassification).toBe("early_departure");
    expect(result.finalClassification).toBe("left_early");
  });

  it("should return absent if no time-in is recorded", () => {
    const result = evaluateAttendance(null, null, baseSchedule);
    expect(result.finalClassification).toBe("absent");
    expect(result.durationMinutes).toBe(0);
  });

  it("should approve certificate eligibility when all required sessions are attended with sufficient duration", () => {
    const records = [
      {
        sessionId: "session-morning",
        finalStatus: "checked_out" as const,
        durationMinutes: 180,
      },
      {
        sessionId: "session-afternoon",
        finalStatus: "checked_out" as const,
        durationMinutes: 180,
      },
    ];

    const result = checkCertificateEligibility(
      records,
      ["session-morning", "session-afternoon"],
      300 // requires 300 minutes (5 hours)
    );

    expect(result.eligible).toBe(true);
    expect(result.verifiedHours).toBe(6.0);
  });

  it("should reject certificate eligibility if a required session was missed", () => {
    const records = [
      {
        sessionId: "session-morning",
        finalStatus: "checked_out" as const,
        durationMinutes: 180,
      },
      // session-afternoon is absent
    ];

    const result = checkCertificateEligibility(
      records,
      ["session-morning", "session-afternoon"],
      180
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Missed one or more required event sessions");
  });
});
