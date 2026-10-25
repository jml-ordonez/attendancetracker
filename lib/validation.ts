import { z } from "zod";

/**
 * Validation shared by the forms (instant feedback) and the API routes (the
 * real gate). The client can be bypassed, so every route re-checks with these.
 */

export const MAJORS: Record<string, string> = {
  "BSBA-MM": "BSBA in Marketing Management",
  "BSBA-FM": "BSBA in Financial Management",
  "BSBA-HRM": "BSBA in Human Resource Management",
  "BSBA-OM": "BSBA in Operations Management",
};

export const MAJOR_SHORT: Record<string, string> = {
  "BSBA-MM": "Marketing",
  "BSBA-FM": "Financial",
  "BSBA-HRM": "Human Resource",
  "BSBA-OM": "Operations",
};

export const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;

export const STUDENT_ID_PATTERN = /^(?:\d{10}|\d{4}-\d{5}-BA)$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const UA_EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@ua\.edu\.ph$/i;
export const SECTION_PATTERN = /^(?:(MM|FM|HRM|OM)-[1-4][A-Z0-9]|BA-(MM|FM|HRM|OM) [1-4]-[1-9]\d?)$/i;
export const NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*$/u;

const MAJOR_CODES = Object.keys(MAJORS) as [string, ...string[]];

export const studentIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(STUDENT_ID_PATTERN, "Use the format e.g 2022001234 (10-digit student ID).")
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    const year = Number(digits.slice(0, 4));
    return year >= 2000 && year <= new Date().getFullYear();
  }, "The year at the start of the ID isn't valid.");

export const personNameSchema = z
  .string()
  .trim()
  .min(2, "Enter the full name.")
  .max(80, "Keep the name under 80 characters.")
  .regex(/^[\p{L}][\p{L}\s'.-]*$/u, "Use letters only (spaces, hyphens and apostrophes allowed).");

export const majorCodeSchema = z.enum(MAJOR_CODES, { message: "Choose a program." });

export const sectionSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SECTION_PATTERN, "Use the format MM-1A (program, year and section).");

/** Derives the major program code from the section string (e.g. MM-1A -> BSBA-MM). */
export function deriveMajorFromSection(section: string): string {
  const sec = section.trim().toUpperCase();
  const match = sec.match(/^(?:BA-)?(MM|FM|HRM|OM)/);
  if (match) return `BSBA-${match[1]}`;
  return "BSBA-MM";
}

/** The section's program must match the chosen major, e.g. BSBA-FM -> FM-2A or BA-FM 2-1. */
export function sectionMatchesMajor(section: string, majorCode: string): boolean {
  const sec = section.trim().toUpperCase();
  const code = majorCode.replace("BSBA-", "").toUpperCase();
  return sec.startsWith(`${code}-`) || sec.startsWith(`BA-${code} `) || sec.startsWith(`BA-${code}-`);
}

/** The year digit in the section must match the year level, e.g. 1st Year -> MM-1A. */
export function sectionMatchesYear(section: string, yearLevel: string): boolean {
  const year = YEAR_LEVELS.indexOf(yearLevel as (typeof YEAR_LEVELS)[number]) + 1;
  if (year <= 0) return false;
  const sec = section.trim().toUpperCase();
  return new RegExp(`^(?:[A-Z]+-${year}[A-Z0-9]|BA-[A-Z]+ ${year}-)`).test(sec);
}

export const purposeSchema = z.enum(["time_in", "time_out"], { message: "Choose check-in or check-out." });

export const reasonSchema = z
  .string()
  .trim()
  .min(10, "Give a reason of at least 10 characters for the audit log.")
  .max(300, "Keep the reason under 300 characters.");

/** Flattens a zod error into `{ field: "first message" }` for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flat)) if (messages?.[0]) out[key] = messages[0];
  return out;
}
