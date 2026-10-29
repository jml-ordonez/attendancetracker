/**
 * Student registration, stored on the student's own device.
 *
 * Students do not have accounts or passwords: they register their student
 * identity (ID number, name, program, section) and the event they attend once to generate dynamic
 * attendance passes for time-in and time-out. Staff sessions are a signed
 * server cookie (see `admin-session.ts`), not local storage.
 */

import { useSyncExternalStore } from "react";
import { MAJORS } from "@/lib/validation";

export interface RegisteredStudentSession {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  studentIdNumber: string;
  email: string;
  majorCode: string;
  majorName: string;
  yearLevel: string;
  section: string;
  /** The event the student registered for; missing on registrations made before events were chosen. */
  eventId?: string;
  registeredAt: string;
}

const STUDENT_STORAGE_KEY = "ba_registered_student";
/** Left behind by the old localStorage admin session; removed on sight. */
const LEGACY_ADMIN_KEY = "ba_admin_session";

const isBrowser = () => typeof window !== "undefined";

function isStudentRecord(value: unknown): value is RegisteredStudentSession {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.fullName === "string" &&
    typeof v.studentIdNumber === "string" &&
    typeof v.email === "string" &&
    typeof v.majorCode === "string" &&
    typeof v.section === "string" &&
    (v.eventId === undefined || typeof v.eventId === "string")
  );
}

// Parsed once per stored value, so useSyncExternalStore gets a stable snapshot.
let cache: { raw: string | null; value: RegisteredStudentSession | null } = { raw: null, value: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getRegisteredStudent(): RegisteredStudentSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STUDENT_STORAGE_KEY);
    if (raw === cache.raw) return cache.value;
    let value: RegisteredStudentSession | null = null;
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      value = isStudentRecord(parsed) ? parsed : null;
    }
    cache = { raw, value };
    return value;
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab registering or clearing updates this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STUDENT_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  try {
    localStorage.removeItem(LEGACY_ADMIN_KEY);
  } catch {}
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The student registered on this device. `undefined` during server rendering
 * and hydration (storage isn't readable yet), then the stored value or null.
 */
export function useRegisteredStudent(): RegisteredStudentSession | null | undefined {
  return useSyncExternalStore(subscribe, getRegisteredStudent, () => undefined);
}

export function registerStudent(
  profile: Omit<RegisteredStudentSession, "id" | "registeredAt" | "fullName" | "majorName">
): RegisteredStudentSession {
  const existing = getRegisteredStudent();
  const student: RegisteredStudentSession = {
    ...profile,
    // randomUUID only exists in secure contexts; phones on a LAN address over http are not one.
    id: existing?.id ?? (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `student-${Date.now()}`),
    fullName: `${profile.firstName} ${profile.lastName}`,
    majorName: MAJORS[profile.majorCode] ?? MAJORS["BSBA-MM"],
    registeredAt: existing?.registeredAt ?? new Date().toISOString(),
  };
  localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(student));
  emit();
  return student;
}

export function clearStudentRegistration(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STUDENT_STORAGE_KEY);
  } catch {}
  emit();
}
