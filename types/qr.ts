export type TokenPurpose = "time_in" | "time_out" | "checkpoint";

export interface DecryptedQRPayload {
  tid: string;       // Unique Token Identifier (UUIDv4)
  sid: string;       // Student UUID
  sname?: string;    // Student Full Name
  snum?: string;     // Student ID Number (e.g. 2023-01492-BA)
  smaj?: string;     // Program code (e.g. BSBA-MM)
  ssec?: string;     // Section (e.g. BA-MM 3-1)
  eid: string;       // Event UUID
  ssid: string;      // Session UUID
  cid?: string;      // Checkpoint UUID (optional)
  p: TokenPurpose;   // Purpose: time_in, time_out, checkpoint
  iat: number;       // Issued At (unix timestamp in seconds)
  exp: number;       // Expiry (unix timestamp in seconds)
  nonce: string;     // Cryptographic random nonce
}

export interface QREnvelope {
  v: number;         // Token format version (e.g. 1)
  kid: string;       // Key identifier for versioned rotation (e.g. "k1")
  iv: string;        // 8-byte initialization vector in hex (16 chars)
  ct: string;        // 3DES ciphertext in hex
  mac: string;       // HMAC-SHA256 signature in hex
}

export type ScanVerificationStatus =
  | "SUCCESS_ON_TIME"
  | "SUCCESS_LATE"
  | "SUCCESS_CHECKOUT"
  | "SUCCESS_CHECKOUT_EARLY"
  | "DUPLICATE_SCAN"
  | "DUPLICATE_TOKEN_USE"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "TOKEN_TAMPERED"
  | "STUDENT_INELIGIBLE"
  | "WINDOW_CLOSED"
  | "SESSION_NOT_FOUND"
  | "OFFICER_UNAUTHORIZED"
  | "SERVER_ERROR";

export interface ScanVerificationResult {
  success: boolean;
  status: ScanVerificationStatus;
  message: string;
  timestamp: string;
  details?: {
    studentName?: string;
    studentIdNumber?: string;
    eventTitle?: string;
    sessionTitle?: string;
    action?: TokenPurpose;
    timeIn?: string;
    timeOut?: string;
    durationMinutes?: number;
    isLate?: boolean;
    isEarlyDeparture?: boolean;
    failureReason?: string;
  };
}
