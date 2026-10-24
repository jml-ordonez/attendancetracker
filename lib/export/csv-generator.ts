export interface CSVAttendanceRow {
  studentIdNumber: string;
  studentName: string;
  major: string;
  yearLevel: string;
  section: string;
  eventTitle: string;
  sessionTitle: string;
  timeIn: string;
  timeOut: string;
  durationMinutes: number;
  timeInStatus: string;
  timeOutStatus: string;
  finalStatus: string;
}

export function generateAttendanceCSV(rows: CSVAttendanceRow[]): string {
  const headers = [
    "Student ID Number",
    "Student Full Name",
    "Major Program",
    "Year Level",
    "Section",
    "Event Title",
    "Session Title",
    "Time In",
    "Time Out",
    "Duration (Mins)",
    "Time In Classification",
    "Time Out Classification",
    "Final Attendance Status",
  ];

  const escapeCSV = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '""';
    let stringVal = String(value);
    // Neutralise spreadsheet formulas (CSV injection) in free-text fields such as event titles.
    if (/^[=+\-@\t\r]/.test(stringVal)) stringVal = `'${stringVal}`;
    if (stringVal.includes(",") || stringVal.includes('"') || stringVal.includes("\n")) {
      return `"${stringVal.replace(/"/g, '""')}"`;
    }
    return `"${stringVal}"`;
  };

  const lines = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) =>
      [
        escapeCSV(row.studentIdNumber),
        escapeCSV(row.studentName),
        escapeCSV(row.major),
        escapeCSV(row.yearLevel),
        escapeCSV(row.section),
        escapeCSV(row.eventTitle),
        escapeCSV(row.sessionTitle),
        escapeCSV(row.timeIn),
        escapeCSV(row.timeOut),
        row.durationMinutes,
        escapeCSV(row.timeInStatus),
        escapeCSV(row.timeOutStatus),
        escapeCSV(row.finalStatus),
      ].join(",")
    ),
  ];

  return lines.join("\r\n");
}
