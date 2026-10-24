import { beforeEach, describe, expect, it } from "vitest";
import { recordAttendance } from "../lib/attendance/record";
import { clearScans, listScans } from "../lib/attendance/store";
import { buildRoll } from "../lib/attendance/roll";
import { createSessionToken, verifySessionToken } from "../lib/auth/admin-session";
import { sectionMatchesMajor, sectionMatchesYear } from "../lib/validation";

// Seeded "Morning keynote": check-in 08:00–09:00 (UTC+8), 15 min grace, check-out 12:00–13:00.
const EVENT = "a2b4c6d8-1111-2222-3333-444455556666";
const SESSION = "b3c5d7e9-2222-3333-4444-555566667777";
const at = (hhmm: string) => new Date(`2026-10-24T${hhmm}:00+08:00`);
const student = { name: "Maria Santos", idNumber: "2024-01492-BA", majorCode: "BSBA-FM", section: "BA-FM 2-1" };
const scan = (purpose: "time_in" | "time_out", time: string, extra: Partial<Parameters<typeof recordAttendance>[0]> = {}) =>
  recordAttendance({ student, eventId: EVENT, sessionId: SESSION, purpose, officer: "Test", method: "qr", now: at(time), ...extra });

describe("Attendance pipeline", () => {
  beforeEach(() => clearScans());

  it("checks in on time within the grace period", () => {
    const r = scan("time_in", "08:10");
    expect(r.success).toBe(true);
    expect(r.status).toBe("SUCCESS_ON_TIME");
    expect(listScans()[0].majorCode).toBe("BSBA-FM");
  });

  it("marks a check-in after the grace period as late", () => {
    expect(scan("time_in", "08:20").status).toBe("SUCCESS_LATE");
  });

  it("refuses check-in before the window opens and after the session ends", () => {
    expect(scan("time_in", "06:30").status).toBe("WINDOW_CLOSED");
    expect(scan("time_in", "13:30").status).toBe("WINDOW_CLOSED");
  });

  it("refuses a second check-in for the same session", () => {
    scan("time_in", "08:05");
    const r = scan("time_in", "08:07");
    expect(r.success).toBe(false);
    expect(r.status).toBe("DUPLICATE_SCAN");
  });

  it("refuses a check-out without a check-in", () => {
    expect(scan("time_out", "12:10").status).toBe("STUDENT_INELIGIBLE");
  });

  it("records the stay and flags an early departure", () => {
    scan("time_in", "08:00");
    const r = scan("time_out", "11:00");
    expect(r.status).toBe("SUCCESS_CHECKOUT_EARLY");
    expect(r.details?.durationMinutes).toBe(180);
  });

  it("accepts a QR token only once", () => {
    const token = { id: "tok-1", expiresAt: Math.floor(Date.now() / 1000) + 60 };
    expect(scan("time_in", "08:05", { token }).success).toBe(true);
    expect(scan("time_out", "12:30", { token }).status).toBe("DUPLICATE_TOKEN_USE");
    expect(scan("time_out", "12:31", { token: { ...token, id: "tok-2" } }).success).toBe(true);
  });

  it("pairs check-in and check-out into one roll entry", () => {
    scan("time_in", "08:20");
    scan("time_out", "12:30");
    const roll = buildRoll(listScans());
    expect(roll).toHaveLength(1);
    expect(roll[0].finalStatus).toBe("late");
    expect(roll[0].durationMinutes).toBe(250);
  });
});

describe("Staff session cookie", () => {
  const admin = { email: "a@b.edu", name: "Test", title: "Chair", role: "administrator" as const };

  it("round-trips a signed session", () => {
    expect(verifySessionToken(createSessionToken(admin))).toEqual(admin);
  });

  it("rejects a tampered or expired session", () => {
    const token = createSessionToken(admin);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...admin, role: "administrator", name: "Mallory", exp: 9999999999 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`)).toBeNull();
    expect(verifySessionToken(`${body}.x${sig.slice(1)}`)).toBeNull();
    expect(verifySessionToken(createSessionToken(admin, Date.now() - 9 * 3600 * 1000))).toBeNull();
  });
});

describe("Section validation", () => {
  it("matches the section to the major and year", () => {
    expect(sectionMatchesMajor("BA-FM 2-1", "BSBA-FM")).toBe(true);
    expect(sectionMatchesMajor("BA-MM 2-1", "BSBA-FM")).toBe(false);
    expect(sectionMatchesYear("BA-FM 2-1", "2nd Year")).toBe(true);
    expect(sectionMatchesYear("BA-FM 3-1", "2nd Year")).toBe(false);
  });
});
