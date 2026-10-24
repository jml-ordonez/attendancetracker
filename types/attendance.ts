export type ScanAction = "time_in" | "time_out";

export type ScanStatus = "on_time" | "late" | "checked_out" | "left_early";

/** Status a coordinator may set when correcting a student's attendance. */
export type CorrectedStatus = "present" | "late" | "checked_out" | "left_early" | "excused";

export interface ScanCorrection {
  status: CorrectedStatus;
  reason: string;
  by: string;
  at: string;
}

/** One verified scan at the door (or one authorised manual entry). */
export interface AttendanceScan {
  id: string;
  studentName: string;
  studentIdNumber: string;
  /** Program code, e.g. "BSBA-MM". */
  majorCode: string;
  section: string;
  eventId: string;
  eventTitle: string;
  sessionId: string;
  sessionTitle: string;
  action: ScanAction;
  status: ScanStatus;
  method: "qr" | "manual";
  /** ISO timestamp from the server clock. Format it on the client, in the viewer's time zone. */
  timestamp: string;
  durationMinutes?: number;
  officer: string;
  /** Set on the time-in scan when a coordinator corrects the attendance. */
  correction?: ScanCorrection;
}

/** A student's attendance for one session: the time-in and time-out scans paired. */
export interface RollEntry {
  key: string;
  studentName: string;
  studentIdNumber: string;
  majorCode: string;
  section: string;
  eventId: string;
  eventTitle: string;
  sessionId: string;
  sessionTitle: string;
  timeIn?: string;
  timeOut?: string;
  timeInScanId?: string;
  timeInStatus?: ScanStatus;
  finalStatus: CorrectedStatus;
  durationMinutes: number;
  correction?: ScanCorrection;
}
