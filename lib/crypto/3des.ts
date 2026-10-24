import crypto from "crypto";
import { QREnvelope, DecryptedQRPayload } from "@/types/qr";

/**
 * Triple DES (des-ede3-cbc) Cryptographic Compatibility Module
 * Reinforced with HMAC-SHA256 Encrypt-then-MAC Authentication.
 * 
 * SECURITY NOTICE:
 * 3DES is a legacy cipher required for compatibility.
 * To mitigate padding oracle attacks (e.g. Lucky Thirteen / POODLE-style)
 * and chosen-ciphertext attacks, all ciphertexts are authenticated using
 * HMAC-SHA256 over the header + IV + ciphertext before any decryption is attempted.
 * Verification uses constant-time comparison (crypto.timingSafeEqual).
 */

const CIPHER_ALGO = "des-ede3-cbc";
const HMAC_ALGO = "sha256";
const DES_KEY_BYTES = 24; // 192 bits (3DES 24 bytes)
const DES_IV_BYTES = 8;   // 64 bits block size for DES
const HMAC_KEY_BYTES = 32; // 256 bits for HMAC-SHA256

interface KeyConfig {
  desKey: Buffer;
  hmacKey: Buffer;
  keyId: string;
}

function parseHexOrBuffer(value: string | undefined, expectedBytes: number, name: string): Buffer {
  if (!value) {
    throw new Error(`[Crypto Configuration Error] Missing environment secret: ${name}`);
  }
  const clean = value.trim();
  let buf: Buffer;
  if (/^[0-9a-fA-F]+$/.test(clean) && clean.length === expectedBytes * 2) {
    buf = Buffer.from(clean, "hex");
  } else if (/^[A-Za-z0-9+/=]+$/.test(clean)) {
    buf = Buffer.from(clean, "base64");
  } else {
    buf = Buffer.from(clean, "utf-8");
  }

  if (buf.length !== expectedBytes) {
    throw new Error(
      `[Crypto Configuration Error] ${name} must be exactly ${expectedBytes} bytes. Found: ${buf.length} bytes.`
    );
  }
  return buf;
}

export function getCryptoKeys(): KeyConfig {
  const rawDes = process.env.QR_3DES_SECRET_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef";
  const rawHmac = process.env.QR_HMAC_SECRET_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const keyId = process.env.QR_KEY_VERSION || "k1";

  const desKey = parseHexOrBuffer(rawDes, DES_KEY_BYTES, "QR_3DES_SECRET_KEY");
  const hmacKey = parseHexOrBuffer(rawHmac, HMAC_KEY_BYTES, "QR_HMAC_SECRET_KEY");

  return { desKey, hmacKey, keyId };
}

/**
 * Calculates HMAC-SHA256 over envelope metadata: (v || kid || iv || ct)
 */
function computeMac(version: number, kid: string, ivHex: string, ctHex: string, hmacKey: Buffer): string {
  const hmac = crypto.createHmac(HMAC_ALGO, hmacKey);
  hmac.update(`v${version}:kid${kid}:iv${ivHex}:ct${ctHex}`, "utf8");
  return hmac.digest("hex");
}

/**
 * Encrypts a dynamic QR payload into an authenticated 3DES envelope.
 */
export function encryptPayload(payload: DecryptedQRPayload, keys?: KeyConfig): string {
  const { desKey, hmacKey, keyId } = keys || getCryptoKeys();

  const iv = crypto.randomBytes(DES_IV_BYTES);
  const ivHex = iv.toString("hex");

  const plaintext = JSON.stringify(payload);
  const cipher = crypto.createCipheriv(CIPHER_ALGO, desKey, iv);
  
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const version = 1;
  const mac = computeMac(version, keyId, ivHex, ciphertext, hmacKey);

  const envelope: QREnvelope = {
    v: version,
    kid: keyId,
    iv: ivHex,
    ct: ciphertext,
    mac: mac,
  };

  // Compact URL-safe Base64 representation of envelope
  const envelopeJson = JSON.stringify(envelope);
  return Buffer.from(envelopeJson, "utf8").toString("base64url");
}

export interface DecryptResult {
  success: boolean;
  payload?: DecryptedQRPayload;
  error?: "INVALID_FORMAT" | "MAC_VERIFICATION_FAILED" | "DECRYPTION_FAILED" | "MALFORMED_PAYLOAD";
}

/**
 * Verifies HMAC integrity and decrypts 3DES payload.
 * Constant-time MAC verification guarantees rejection prior to any 3DES operation.
 */
export function decryptPayload(tokenString: string, keys?: KeyConfig): DecryptResult {
  try {
    const { desKey, hmacKey } = keys || getCryptoKeys();

    if (!tokenString || typeof tokenString !== "string") {
      return { success: false, error: "INVALID_FORMAT" };
    }

    let envelopeJson: string;
    try {
      envelopeJson = Buffer.from(tokenString, "base64url").toString("utf8");
    } catch {
      return { success: false, error: "INVALID_FORMAT" };
    }

    let envelope: QREnvelope;
    try {
      envelope = JSON.parse(envelopeJson);
    } catch {
      return { success: false, error: "INVALID_FORMAT" };
    }

    if (!envelope.v || !envelope.kid || !envelope.iv || !envelope.ct || !envelope.mac) {
      return { success: false, error: "INVALID_FORMAT" };
    }

    // Step 1: Encrypt-Then-MAC Verification (Constant Time)
    const expectedMac = computeMac(envelope.v, envelope.kid, envelope.iv, envelope.ct, hmacKey);
    const expectedBuf = Buffer.from(expectedMac, "hex");
    const actualBuf = Buffer.from(envelope.mac, "hex");

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return { success: false, error: "MAC_VERIFICATION_FAILED" };
    }

    // Step 2: 3DES CBC Decryption
    const iv = Buffer.from(envelope.iv, "hex");
    if (iv.length !== DES_IV_BYTES) {
      return { success: false, error: "INVALID_FORMAT" };
    }

    const decipher = crypto.createDecipheriv(CIPHER_ALGO, desKey, iv);
    let decryptedText = decipher.update(envelope.ct, "hex", "utf8");
    decryptedText += decipher.final("utf8");

    // Step 3: Payload Parsing and Field Validation
    const payload = JSON.parse(decryptedText) as DecryptedQRPayload;
    if (!payload.tid || !payload.sid || !payload.eid || !payload.ssid || !payload.p || !payload.exp) {
      return { success: false, error: "MALFORMED_PAYLOAD" };
    }

    return { success: true, payload };
  } catch {
    return { success: false, error: "DECRYPTION_FAILED" };
  }
}
