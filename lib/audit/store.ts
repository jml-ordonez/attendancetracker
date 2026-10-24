/**
 * Audit trail of actions taken inside the system.
 *
 * In-memory, like the attendance store: it survives requests in one server
 * process and resets when the server restarts. Newest entries first.
 */

export type AuditCategory = "auth" | "attendance" | "events" | "records" | "reports";
export type AuditOutcome = "success" | "failure";

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  actorEmail?: string;
  category: AuditCategory;
  /** Stable machine name, e.g. `scan.verified`. */
  action: string;
  /** One sentence a person can read. */
  summary: string;
  target?: string;
  outcome: AuditOutcome;
  ip?: string;
  details?: Record<string, string | number | boolean | null>;
}

const MAX_ENTRIES = 5000;

const g = globalThis as unknown as { __ba_audit?: AuditEntry[] };
if (!g.__ba_audit) g.__ba_audit = [];

export function logAudit(entry: Omit<AuditEntry, "id" | "at">): AuditEntry {
  const record: AuditEntry = {
    ...entry,
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
  };
  const list = g.__ba_audit!;
  list.unshift(record);
  if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
  return record;
}

export function listAudit(): AuditEntry[] {
  return g.__ba_audit ?? [];
}
