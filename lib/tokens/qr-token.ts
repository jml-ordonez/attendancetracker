import crypto from "crypto";
import { encryptPayload, decryptPayload } from "@/lib/crypto/3des";
import { DecryptedQRPayload, TokenPurpose } from "@/types/qr";

export interface CreateTokenParams {
  studentId: string;
  studentName?: string;
  studentIdNumber?: string;
  majorCode?: string;
  section?: string;
  eventId: string;
  sessionId: string;
  checkpointId?: string;
  purpose: TokenPurpose;
  expirySeconds?: number;
}

export interface GeneratedTokenResult {
  token: string;
  tokenId: string;
  issuedAt: number;
  expiresAt: number;
  expirySeconds: number;
}

export interface ValidationCheckResult {
  valid: boolean;
  errorCode?: "TOKEN_EXPIRED" | "PURPOSE_MISMATCH" | "EVENT_MISMATCH" | "SESSION_MISMATCH" | "INVALID_TOKEN";
  payload?: DecryptedQRPayload;
  serverTime: number;
}

const DEFAULT_EXPIRY_SECONDS = 45;

/**
 * Generates an encrypted dynamic single-use QR token with CSPRNG nonce.
 */
export function generateStudentQRToken(params: CreateTokenParams): GeneratedTokenResult {
  const tokenId = crypto.randomUUID();
  const issuedAt = Math.floor(Date.now() / 1000);
  const expirySeconds = params.expirySeconds || DEFAULT_EXPIRY_SECONDS;
  const expiresAt = issuedAt + expirySeconds;
  const nonce = crypto.randomBytes(8).toString("hex");

  const payload: DecryptedQRPayload = {
    tid: tokenId,
    sid: params.studentId,
    sname: params.studentName,
    snum: params.studentIdNumber,
    smaj: params.majorCode,
    ssec: params.section,
    eid: params.eventId,
    ssid: params.sessionId,
    cid: params.checkpointId,
    p: params.purpose,
    iat: issuedAt,
    exp: expiresAt,
    nonce: nonce,
  };

  const token = encryptPayload(payload);

  return {
    token,
    tokenId,
    issuedAt,
    expiresAt,
    expirySeconds,
  };
}

/**
 * Validates token decryption, expiry against server time, and purpose matching.
 */
export function validateTokenIntegrity(
  tokenString: string,
  expectedPurpose?: TokenPurpose,
  expectedEventId?: string,
  expectedSessionId?: string,
  currentTimeSec?: number
): ValidationCheckResult {
  const now = currentTimeSec !== undefined ? currentTimeSec : Math.floor(Date.now() / 1000);

  const decryptResult = decryptPayload(tokenString);
  if (!decryptResult.success || !decryptResult.payload) {
    return {
      valid: false,
      errorCode: "INVALID_TOKEN",
      serverTime: now,
    };
  }

  const payload = decryptResult.payload;

  // Strict Server-Time Expiry Verification
  if (now > payload.exp) {
    return {
      valid: false,
      errorCode: "TOKEN_EXPIRED",
      payload,
      serverTime: now,
    };
  }

  // Purpose Validation (e.g. Cannot submit a time_out token at time_in checkpoint)
  if (expectedPurpose && payload.p !== expectedPurpose) {
    return {
      valid: false,
      errorCode: "PURPOSE_MISMATCH",
      payload,
      serverTime: now,
    };
  }

  // Event Context Validation
  if (expectedEventId && payload.eid !== expectedEventId) {
    return {
      valid: false,
      errorCode: "EVENT_MISMATCH",
      payload,
      serverTime: now,
    };
  }

  // Session Context Validation
  if (expectedSessionId && payload.ssid !== expectedSessionId) {
    return {
      valid: false,
      errorCode: "SESSION_MISMATCH",
      payload,
      serverTime: now,
    };
  }

  return {
    valid: true,
    payload,
    serverTime: now,
  };
}
