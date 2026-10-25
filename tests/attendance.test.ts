import { beforeEach, describe, expect, it } from "vitest";
import { recordAttendance } from "../lib/attendance/record";
import { clearScans, listScans } from "../lib/attendance/store";
import { buildRoll } from "../lib/attendance/roll";
import { createSessionToken, verifySessionToken } from "../lib/auth/admin-session";
import { ADMIN_USERS, DEMO_ADMIN } from "../lib/auth/demo";
import {
  SECTION_PATTERN,
  STUDENT_ID_PATTERN,
  UA_EMAIL_PATTERN,
  deriveMajorFromSection,
  sectionMatchesMajor,
  sectionMatchesYear,
  sectionSchema,
  studentIdSchema,
} from "../lib/validation";

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

describe("Admin credentials", () => {
  it("includes admin user with masteradmin2526 password", () => {
    const adminUser = ADMIN_USERS.find((u) => u.username === "admin");
    expect(adminUser).toBeDefined();
    expect(adminUser?.password).toBe("masteradmin2526");
    expect(adminUser?.role).toBe("administrator");
  });

  it("sets DEMO_ADMIN default to the admin account", () => {
    expect(DEMO_ADMIN.username).toBe("admin");
    expect(DEMO_ADMIN.password).toBe("masteradmin2526");
  });
});

describe("Section validation", () => {
  it("matches the section to the major and year", () => {
    expect(sectionMatchesMajor("BA-FM 2-1", "BSBA-FM")).toBe(true);
    expect(sectionMatchesMajor("BA-MM 2-1", "BSBA-FM")).toBe(false);
    expect(sectionMatchesYear("BA-FM 2-1", "2nd Year")).toBe(true);
    expect(sectionMatchesYear("BA-FM 3-1", "2nd Year")).toBe(false);

    // MM-1A format
    expect(sectionMatchesMajor("MM-1A", "BSBA-MM")).toBe(true);
    expect(sectionMatchesMajor("MM-1A", "BSBA-FM")).toBe(false);
    expect(sectionMatchesYear("MM-1A", "1st Year")).toBe(true);
    expect(sectionMatchesYear("MM-1A", "2nd Year")).toBe(false);
    expect(sectionMatchesMajor("FM-2B", "BSBA-FM")).toBe(true);
    expect(sectionMatchesYear("FM-2B", "2nd Year")).toBe(true);
  });

  it("derives the major from the section", () => {
    expect(deriveMajorFromSection("MM-1A")).toBe("BSBA-MM");
    expect(deriveMajorFromSection("FM-2B")).toBe("BSBA-FM");
    expect(deriveMajorFromSection("HRM-3A")).toBe("BSBA-HRM");
    expect(deriveMajorFromSection("OM-4A")).toBe("BSBA-OM");
  });
});

describe("Student registration validation", () => {
  it("validates 10-digit student ID format including 2021003213 and 2022001234", () => {
    expect(STUDENT_ID_PATTERN.test("2021003213")).toBe(true);
    expect(STUDENT_ID_PATTERN.test("2022001234")).toBe(true);
    expect(STUDENT_ID_PATTERN.test("2024-01492-BA")).toBe(true);
    expect(STUDENT_ID_PATTERN.test("invalid")).toBe(false);
    expect(STUDENT_ID_PATTERN.test("12345")).toBe(false);

    expect(studentIdSchema.safeParse("2021003213").success).toBe(true);
    expect(studentIdSchema.safeParse("2024-01492-BA").success).toBe(true);
  });

  it("validates MM-1A section format schema", () => {
    expect(SECTION_PATTERN.test("MM-1A")).toBe(true);
    expect(sectionSchema.safeParse("MM-1A").success).toBe(true);
    expect(sectionSchema.safeParse("FM-2B").success).toBe(true);
  });

  it("validates university email ending with @ua.edu.ph", () => {
    expect(UA_EMAIL_PATTERN.test("student@ua.edu.ph")).toBe(true);
    expect(UA_EMAIL_PATTERN.test("2021003213@ua.edu.ph")).toBe(true);
    expect(UA_EMAIL_PATTERN.test("student@university.edu")).toBe(false);
    expect(UA_EMAIL_PATTERN.test("student@gmail.com")).toBe(false);
  });
});
