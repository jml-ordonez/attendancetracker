import { describe, it, expect } from "vitest";
import { encryptPayload, encryptPayloadCompact, decryptPayload, getCryptoKeys } from "../lib/crypto/3des";
import { DecryptedQRPayload } from "../types/qr";

describe("3DES (des-ede3-cbc) + HMAC-SHA256 Encrypt-then-MAC Cryptographic Module", () => {
  const samplePayload: DecryptedQRPayload = {
    tid: "550e8400-e29b-41d4-a716-446655440000",
    sid: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    eid: "a2b4c6d8-1111-2222-3333-444455556666",
    ssid: "b3c5d7e9-2222-3333-4444-555566667777",
    cid: "c4d6e8f0-3333-4444-5555-666677778888",
    p: "time_in",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 45,
    nonce: "7a8b9c0d1e2f3a4b",
  };

  it("should successfully encrypt and decrypt a dynamic QR payload", () => {
    const token = encryptPayload(samplePayload);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(50);

    const result = decryptPayload(token);
    expect(result.success).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.payload?.tid).toBe(samplePayload.tid);
    expect(result.payload?.sid).toBe(samplePayload.sid);
    expect(result.payload?.eid).toBe(samplePayload.eid);
    expect(result.payload?.p).toBe("time_in");
  });

  it("round-trips the compact format and keeps it QR-alphanumeric", () => {
    const token = encryptPayloadCompact(samplePayload);
    expect(token).toMatch(/^V2:[A-Z0-9]+:[A-Z2-7]+$/);
    expect(token.length).toBeLessThan(encryptPayload(samplePayload).length);
    const result = decryptPayload(token);
    expect(result.success).toBe(true);
    expect(result.payload?.tid).toBe(samplePayload.tid);
  });

  it("rejects a tampered compact token", () => {
    const token = encryptPayloadCompact(samplePayload);
    const i = token.length - 10;
    const tampered = token.slice(0, i) + (token[i] === "A" ? "B" : "A") + token.slice(i + 1);
    expect(decryptPayload(tampered).success).toBe(false);
    expect(decryptPayload("V2:K1:not-base32!").success).toBe(false);
  });

  it("should generate a fresh random 8-byte IV for every encryption call", () => {
    const token1 = encryptPayload(samplePayload);
    const token2 = encryptPayload(samplePayload);

    // Two encryptions of the same plaintext must produce different tokens due to unique IVs
    expect(token1).not.toBe(token2);

    const env1 = JSON.parse(Buffer.from(token1, "base64url").toString("utf8"));
    const env2 = JSON.parse(Buffer.from(token2, "base64url").toString("utf8"));

    expect(env1.iv).not.toBe(env2.iv);
    expect(env1.iv.length).toBe(16); // 8 bytes in hex = 16 hex chars
    expect(env2.iv.length).toBe(16);
  });

  it("should reject tampered ciphertext with MAC_VERIFICATION_FAILED before decryption", () => {
    const token = encryptPayload(samplePayload);
    const env = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));

    // Tamper with the last character of the ciphertext
    const ctChars = env.ct.split("");
    ctChars[ctChars.length - 1] = ctChars[ctChars.length - 1] === "a" ? "b" : "a";
    env.ct = ctChars.join("");

    const tamperedToken = Buffer.from(JSON.stringify(env), "utf8").toString("base64url");
    const result = decryptPayload(tamperedToken);

    expect(result.success).toBe(false);
    expect(result.error).toBe("MAC_VERIFICATION_FAILED");
  });

  it("should reject tampered MAC signature with MAC_VERIFICATION_FAILED", () => {
    const token = encryptPayload(samplePayload);
    const env = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));

    // Corrupt HMAC
    env.mac = "0000000000000000000000000000000000000000000000000000000000000000";

    const tamperedToken = Buffer.from(JSON.stringify(env), "utf8").toString("base64url");
    const result = decryptPayload(tamperedToken);

    expect(result.success).toBe(false);
    expect(result.error).toBe("MAC_VERIFICATION_FAILED");
  });

  it("should safely handle garbage, non-base64, or malformed inputs without crashing", () => {
    const garbageInputs = [
      "",
      "invalid-token",
      "!!!not-base64-url@@@",
      Buffer.from("{\"invalid\":\"json\"}").toString("base64url"),
      Buffer.from(JSON.stringify({ v: 1 })).toString("base64url"),
    ];

    for (const input of garbageInputs) {
      const result = decryptPayload(input);
      expect(result.success).toBe(false);
    }
  });

  it("should enforce key length validation on startup", () => {
    const keys = getCryptoKeys();
    expect(keys.desKey.length).toBe(24); // Exactly 24 bytes for 3DES
    expect(keys.hmacKey.length).toBe(32); // Exactly 32 bytes for HMAC-SHA256
  });
});
