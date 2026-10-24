import { describe, it, expect } from "vitest";
import { generateStudentQRToken, validateTokenIntegrity } from "../lib/tokens/qr-token";

describe("Dynamic QR Token Lifecycle & Validation Engine", () => {
  const studentId = "student-123";
  const eventId = "event-456";
  const sessionId = "session-789";

  it("should generate a valid time-in token with correct metadata and payload", () => {
    const { token, tokenId, expiresAt } = generateStudentQRToken({
      studentId,
      eventId,
      sessionId,
      purpose: "time_in",
      expirySeconds: 30,
    });

    expect(typeof token).toBe("string");
    expect(tokenId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const validation = validateTokenIntegrity(token, "time_in", eventId, sessionId);
    expect(validation.valid).toBe(true);
    expect(validation.payload?.sid).toBe(studentId);
    expect(validation.payload?.eid).toBe(eventId);
    expect(validation.payload?.ssid).toBe(sessionId);
    expect(validation.payload?.p).toBe("time_in");
  });

  it("should reject expired tokens when validated after expiration timestamp", () => {
    const { token, issuedAt } = generateStudentQRToken({
      studentId,
      eventId,
      sessionId,
      purpose: "time_in",
      expirySeconds: 10,
    });

    // Simulate validation 15 seconds after issue (expired by 5s)
    const futureTime = issuedAt + 15;
    const validation = validateTokenIntegrity(token, "time_in", eventId, sessionId, futureTime);

    expect(validation.valid).toBe(false);
    expect(validation.errorCode).toBe("TOKEN_EXPIRED");
  });

  it("should reject purpose mismatch (e.g. time_in token submitted for time_out)", () => {
    const { token } = generateStudentQRToken({
      studentId,
      eventId,
      sessionId,
      purpose: "time_in",
    });

    const validation = validateTokenIntegrity(token, "time_out", eventId, sessionId);
    expect(validation.valid).toBe(false);
    expect(validation.errorCode).toBe("PURPOSE_MISMATCH");
  });

  it("should reject event context mismatch", () => {
    const { token } = generateStudentQRToken({
      studentId,
      eventId,
      sessionId,
      purpose: "time_in",
    });

    const validation = validateTokenIntegrity(token, "time_in", "unrelated-event-999", sessionId);
    expect(validation.valid).toBe(false);
    expect(validation.errorCode).toBe("EVENT_MISMATCH");
  });

  it("should reject session context mismatch", () => {
    const { token } = generateStudentQRToken({
      studentId,
      eventId,
      sessionId,
      purpose: "time_in",
    });

    const validation = validateTokenIntegrity(token, "time_in", eventId, "session-other-session");
    expect(validation.valid).toBe(false);
    expect(validation.errorCode).toBe("SESSION_MISMATCH");
  });
});
