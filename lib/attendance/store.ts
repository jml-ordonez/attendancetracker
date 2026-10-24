import type { AttendanceScan, ScanAction, ScanCorrection } from "@/types/attendance";

/**
 * Live attendance store shared by the scanner, manual entry, the dashboard and
 * reports. In-memory: it survives requests in one server process and resets on
 * restart. Newest scans first.
 */

const g = globalThis as unknown as {
  __ba_scans?: AttendanceScan[];
  /** Consumed QR token ids → expiry (unix seconds), for single-use enforcement. */
  __ba_tokens?: Map<string, number>;
};
if (!g.__ba_scans) g.__ba_scans = [];
if (!g.__ba_tokens) g.__ba_tokens = new Map();

export function listScans(): AttendanceScan[] {
  return g.__ba_scans!;
}

export function addScan(scan: Omit<AttendanceScan, "id">): AttendanceScan {
  const record: AttendanceScan = { ...scan, id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
  g.__ba_scans!.unshift(record);
  return record;
}

export function findScan(studentIdNumber: string, sessionId: string, action: ScanAction): AttendanceScan | undefined {
  return g.__ba_scans!.find(
    (s) => s.studentIdNumber === studentIdNumber && s.sessionId === sessionId && s.action === action
  );
}

export function getScan(id: string): AttendanceScan | undefined {
  return g.__ba_scans!.find((s) => s.id === id);
}

export function correctScan(id: string, correction: ScanCorrection): AttendanceScan | null {
  const scan = getScan(id);
  if (!scan) return null;
  scan.correction = correction;
  return scan;
}

export function clearScans(): number {
  const count = g.__ba_scans!.length;
  g.__ba_scans = [];
  g.__ba_tokens = new Map();
  return count;
}

/**
 * Marks a QR token as used. Returns false when it was already used.
 * Expired ids are pruned as we go; an expired token is rejected before it gets here.
 */
export function consumeToken(tokenId: string, expiresAt: number): boolean {
  const tokens = g.__ba_tokens!;
  if (tokens.has(tokenId)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (tokens.size > 500) {
    for (const [id, exp] of tokens) if (exp < now) tokens.delete(id);
  }
  tokens.set(tokenId, expiresAt);
  return true;
}
