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

export const STUDENT_ID_PATTERN = /^\d{4}-\d{5}-BA$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const SECTION_PATTERN = /^BA-(MM|FM|HRM|OM) [1-4]-[1-9]\d?$/;
export const NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*$/u;

const MAJOR_CODES = Object.keys(MAJORS) as [string, ...string[]];

export const studentIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(STUDENT_ID_PATTERN, "Use the format YYYY-NNNNN-BA, for example 2024-01492-BA.")
  .refine((v) => {
    const year = Number(v.slice(0, 4));
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
  .regex(SECTION_PATTERN, "Use the format BA-MM 3-1 (program, year-section).");

/** The section's program must match the chosen major, e.g. BSBA-FM → BA-FM. */
export function sectionMatchesMajor(section: string, majorCode: string): boolean {
  return section.toUpperCase().startsWith(`BA-${majorCode.replace("BSBA-", "")} `);
}

/** The year digit in the section must match the year level, e.g. 3rd Year → BA-MM 3-1. */
export function sectionMatchesYear(section: string, yearLevel: string): boolean {
  const year = YEAR_LEVELS.indexOf(yearLevel as (typeof YEAR_LEVELS)[number]) + 1;
  return year > 0 && new RegExp(`^BA-[A-Z]+ ${year}-`).test(section.toUpperCase());
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
