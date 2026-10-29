import type { BAEvent, EventSession } from "@/types/events";

const TIME_ZONE = process.env.APP_TIMEZONE || "Asia/Manila";

/** The calendar day of an instant in the department's time zone, e.g. "2026-10-24". */
export function localDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

/**
 * The attendance windows of a single-session event: time-in is the first hour
 * and time-out the last hour, shortened for short events so they never overlap.
 * Keeps `id` when given, so passes already issued for the session stay valid.
 */
export function singleSession(
  eventId: string,
  start: Date,
  end: Date,
  gracePeriodMins: number,
  keep?: Pick<EventSession, "id" | "title">
): EventSession {
  const windowMs = Math.min(60, Math.floor((end.getTime() - start.getTime()) / 60000 / 2)) * 60000;
  return {
    id: keep?.id ?? crypto.randomUUID(),
    event_id: eventId,
    title: keep?.title ?? "Main session",
    session_date: localDay(start),
    time_in_start: start.toISOString(),
    time_in_end: new Date(start.getTime() + windowMs).toISOString(),
    time_out_start: new Date(end.getTime() - windowMs).toISOString(),
    time_out_end: end.toISOString(),
    grace_period_mins: gracePeriodMins,
    order_index: 1,
  };
}

/** Another event with the same title on the same local day, ignoring `exceptId` (the event being edited). */
export function duplicateTitle(events: BAEvent[], title: string, start: Date, exceptId?: string): boolean {
  const day = localDay(start);
  return events.some(
    (e) => e.id !== exceptId && e.title.toLowerCase() === title.toLowerCase() && localDay(new Date(e.start_time)) === day
  );
}
