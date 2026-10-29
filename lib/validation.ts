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

const NAME_MESSAGE = "Use letters only (spaces, hyphens and apostrophes allowed).";

export const studentIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Enter the student ID number.")
  .regex(STUDENT_ID_PATTERN, "Use the 10-digit format, e.g. 2022001234.")
  .refine((v) => {
    const year = Number(v.replace(/\D/g, "").slice(0, 4));
    return year >= 2000 && year <= new Date().getFullYear();
  }, "The year at the start of the ID isn't valid.");

/** A full name as printed on the pass (first + last name, up to 40 characters each). */
export const personNameSchema = z
  .string()
  .trim()
  .min(2, "Enter the full name.")
  .max(100, "Keep the name under 100 characters.")
  .regex(NAME_PATTERN, NAME_MESSAGE);

const namePartSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(40, `Keep your ${label} under 40 characters.`)
    .regex(NAME_PATTERN, NAME_MESSAGE);

export const uaEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your university email.")
  .regex(UA_EMAIL_PATTERN, "Enter a valid university email ending with @ua.edu.ph.");

export const majorCodeSchema = z.enum(MAJOR_CODES, { message: "Choose a program." });

/**
 * The sections students register under. Each names its program (MM = Marketing
 * Management) and year, so the program is derived from the section.
 */
export const SECTIONS = ["MM-1A", "MM-1B", "MM-2A", "MM-2B", "MM-3A", "MM-3B", "MM-4A", "MM-4B"] as const;

export function isKnownSection(section: string): boolean {
  return (SECTIONS as readonly string[]).includes(section.trim().toUpperCase());
}

/** The sections of one year level, e.g. 2nd Year → MM-2A, MM-2B. */
export function sectionsForYear(yearLevel: string): string[] {
  return SECTIONS.filter((s) => sectionMatchesYear(s, yearLevel));
}

/** The year level a section belongs to, e.g. MM-2A → 2nd Year. */
export function yearLevelForSection(section: string): (typeof YEAR_LEVELS)[number] | undefined {
  return YEAR_LEVELS.find((y) => sectionMatchesYear(section, y));
}

export const sectionSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Select your section.")
  .refine(isKnownSection, "Choose a section from the list (MM-1A to MM-4B).");

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

/** The student registration form; the year level is derived from the section. */
export const studentRegistrationSchema = z.object({
  firstName: namePartSchema("first name"),
  lastName: namePartSchema("last name"),
  studentIdNumber: studentIdSchema,
  email: uaEmailSchema,
  section: sectionSchema,
  eventId: z.string().trim().min(1, "Choose the event you're attending."),
});

/** Free text that must say something: trimmed, inner whitespace collapsed, at least one letter or digit. */
const textSchema = (min: number, max: number, tooShort: string, tooLong: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(min, tooShort)
        .max(max, tooLong)
        .regex(/[\p{L}\p{N}]/u, tooShort)
    );

const DAY_MS = 24 * 60 * 60 * 1000;
/** Shortest event: time-in and time-out each need a window of their own. */
export const MIN_EVENT_MINS = 15;
export const ENDED_MESSAGE = "This time has already passed. Choose a later end.";

const eventFields = {
  title: textSchema(5, 120, "Enter a title of at least 5 characters.", "Keep the title under 120 characters."),
  description: textSchema(10, 500, "Add a short description (at least 10 characters).", "Keep the description under 500 characters."),
  venue: textSchema(3, 120, "Enter the venue (at least 3 characters).", "Keep the venue under 120 characters."),
  start: z.iso.datetime({ offset: true, message: "Choose a start date and time." }),
  end: z.iso.datetime({ offset: true, message: "Choose an end date and time." }),
  gracePeriodMins: z
    .number({ message: "Enter the grace period in minutes." })
    .int("Enter whole minutes.")
    .min(0, "Use 0 to 120 minutes.")
    .max(120, "Use 0 to 120 minutes."),
};

/** Schedule rules shared by create and edit. `requireFuture`: the end can't already have passed. */
function checkSchedule(
  v: { start: string; end: string; gracePeriodMins: number },
  ctx: z.RefinementCtx,
  requireFuture: boolean
) {
  const start = new Date(v.start).getTime();
  const end = new Date(v.end).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return;
  if (end <= start) ctx.addIssue({ code: "custom", path: ["end"], message: "The end must be after the start." });
  else if (end - start < MIN_EVENT_MINS * 60000)
    ctx.addIssue({ code: "custom", path: ["end"], message: `Make the event at least ${MIN_EVENT_MINS} minutes long.` });
  else if (end - start > DAY_MS) ctx.addIssue({ code: "custom", path: ["end"], message: "Split events longer than a day into separate events." });
  else if (requireFuture && end <= Date.now()) ctx.addIssue({ code: "custom", path: ["end"], message: ENDED_MESSAGE });
  else if (v.gracePeriodMins * 60000 >= end - start)
    ctx.addIssue({ code: "custom", path: ["gracePeriodMins"], message: "The grace period must be shorter than the event." });
}

/** A new event, checked by the "New event" form and again by POST /api/events. */
export const eventInputSchema = z
  .object({ ...eventFields, publish: z.boolean() })
  .superRefine((v, ctx) => checkSchedule(v, ctx, true));

/**
 * Changes to an existing event (PUT /api/events/:id). A past end is allowed so
 * typos in finished events can be fixed; the route refuses moving the schedule
 * into the past. `expectedUpdatedAt` is the version the editor started from.
 */
export const eventUpdateSchema = z
  .object({ ...eventFields, expectedUpdatedAt: z.string().min(1).optional() })
  .superRefine((v, ctx) => checkSchedule(v, ctx, false));

export type EventInput = z.infer<typeof eventInputSchema>;
export type EventUpdate = z.infer<typeof eventUpdateSchema>;

/** Event ids are UUIDs; anything else is answered with 404 instead of reaching the database. */
export const eventIdSchema = z.guid();

export const purposeSchema = z.enum(["time_in", "time_out"], { message: "Choose time-in or time-out." });

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
