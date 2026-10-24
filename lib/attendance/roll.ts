import type { AttendanceScan, CorrectedStatus, RollEntry } from "@/types/attendance";

/**
 * Pairs each student's time-in and time-out scans for a session into one roll
 * entry. Pure, so the coordinator view (client) and the CSV export (server)
 * read attendance the same way.
 */
export function buildRoll(scans: AttendanceScan[]): RollEntry[] {
  const byKey = new Map<string, { in?: AttendanceScan; out?: AttendanceScan }>();

  for (const s of scans) {
    const key = `${s.studentIdNumber}|${s.sessionId}`;
    const pair = byKey.get(key) ?? {};
    if (s.action === "time_in") pair.in = s;
    else pair.out = s;
    byKey.set(key, pair);
  }

  const roll: RollEntry[] = [];
  for (const [key, { in: tin, out: tout }] of byKey) {
    const base = tin ?? tout!;
    let finalStatus: CorrectedStatus;
    if (tout?.status === "left_early") finalStatus = "left_early";
    else if (tin?.status === "late") finalStatus = "late";
    else if (tout) finalStatus = "checked_out";
    else finalStatus = "present";
    if (tin?.correction) finalStatus = tin.correction.status;

    roll.push({
      key,
      studentName: base.studentName,
      studentIdNumber: base.studentIdNumber,
      majorCode: base.majorCode,
      section: base.section,
      eventId: base.eventId,
      eventTitle: base.eventTitle,
      sessionId: base.sessionId,
      sessionTitle: base.sessionTitle,
      timeIn: tin?.timestamp,
      timeOut: tout?.timestamp,
      timeInScanId: tin?.id,
      timeInStatus: tin?.status,
      finalStatus,
      durationMinutes: tout?.durationMinutes ?? 0,
      correction: tin?.correction,
    });
  }

  return roll.sort((a, b) => (b.timeIn ?? "").localeCompare(a.timeIn ?? ""));
}
