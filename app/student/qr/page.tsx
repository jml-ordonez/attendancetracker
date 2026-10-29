"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, PencilLine, RefreshCw, ShieldCheck, Sun } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { SelectField } from "@/components/ui/Field";
import { btn } from "@/components/ui/styles";
import { DynamicQRDisplay } from "@/components/student/DynamicQRDisplay";
import { StudentRegisterModal } from "@/components/auth/StudentRegisterModal";
import { setStudentEvent, useRegisteredStudent } from "@/lib/auth/session";
import { graceEnds, liveSessionsOf, OPENS_EARLY_MINS, registrableEvents, sessionState } from "@/lib/attendance/schedule";
import { useEvents } from "@/lib/client/events";
import { formatDay, formatTime } from "@/lib/format";
import { MAJOR_SHORT, isKnownSection } from "@/lib/validation";
import type { BAEvent } from "@/types/events";

export default function StudentQRPage() {
  const student = useRegisteredStudent();
  const [editing, setEditing] = useState(false);
  const { events, error: eventsError, reload } = useEvents();
  const [chosen, setChosen] = useState<string | null>(null);
  /** Showing the event picker in place of the pass ("Change event"). */
  const [picking, setPicking] = useState(false);

  // Only the sessions of the event the student registered for.
  const registeredEventId = student?.eventId;
  const sessions = useMemo(() => (events && registeredEventId ? liveSessionsOf(events, registeredEventId) : []), [events, registeredEventId]);
  const active = sessions.find((s) => s.session.id === chosen) ?? sessions.find((s) => s.state === "open") ?? sessions[0] ?? null;

  if (student === undefined) return <div className="min-h-dvh bg-card" aria-busy="true" />;

  if (!student) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper p-5">
        <div className="animate-rise w-full max-w-md rounded-2xl border border-line bg-card p-7 text-center sm:p-9">
          <BrandMark className="mx-auto h-12 w-12" />
          <h1 className="mt-5 font-display text-[1.75rem] font-semibold leading-tight">Register to get your pass</h1>
          <p className="mt-2 leading-relaxed text-ink-soft">
            Enter your student details once on this phone. Your attendance pass appears right after. No account or password.
          </p>
          <button type="button" onClick={() => setEditing(true)} className={`${btn.primary} mt-7 h-12 w-full`}>
            Register now
          </button>
          <Link href="/" className={`${btn.ghost} mt-2 w-full`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to start
          </Link>
        </div>
        <StudentRegisterModal isOpen={editing} onClose={() => setEditing(false)} goToPass={false} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-card">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-3 rounded-lg py-1" aria-label="BA Attendance home">
            <BrandMark className="h-11 w-11" />
            <span className="leading-tight">
              <span className="block font-display text-lg font-semibold tracking-tight">BA Attendance</span>
              <span className="hidden text-[13px] font-medium text-ink-soft min-[400px]:block">College of Business Administration</span>
            </span>
          </Link>
          <button type="button" onClick={() => setEditing(true)} className={btn.ghost}>
            <PencilLine className="h-4 w-4" aria-hidden="true" />
            Edit details
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-12 pt-6">
        <h1 className="sr-only">Your attendance pass</h1>

        <Link href="/" className={`${btn.ghost} -ml-3 mb-3`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>

        <article className="animate-rise overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(28,25,23,0.05),0_18px_40px_-20px_rgba(28,25,23,0.3)]">
          {/* Pass header: who this pass belongs to. */}
          <div className="bg-brand px-6 py-5 text-ink">
            <p className="text-sm font-medium text-ink/70">Attendance pass</p>
            <p className="mt-1 font-display text-[1.625rem] font-semibold leading-tight">{student.fullName}</p>
            <p className="figures mt-1 text-[15px] text-ink/85">
              {student.studentIdNumber} · {student.section}
            </p>
            <p className="text-sm text-ink/70">
              {MAJOR_SHORT[student.majorCode]} Management · {student.yearLevel}
            </p>
          </div>

          <div className="p-5 sm:p-6">
            {!isKnownSection(student.section) ? (
              <div className="rounded-xl bg-brand-tint p-6 text-center" role="alert">
                <p className="font-semibold">Update your section to get your pass</p>
                <p className="mt-1 text-sm text-ink-soft">
                  “{student.section}” is no longer on the section list. Choose your section again; it takes a few seconds.
                </p>
                <button type="button" onClick={() => setEditing(true)} className={`${btn.primary} mt-4`}>
                  <PencilLine className="h-4 w-4" aria-hidden="true" />
                  Update details
                </button>
              </div>
            ) : eventsError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-soft px-4 py-3 text-sm font-medium text-rose" role="alert">
                Couldn’t load events. Check your connection.
                <button type="button" onClick={reload} className="press inline-flex items-center gap-1.5 font-semibold hover:underline">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
                </button>
              </div>
            ) : !events ? (
              <div className="h-80 animate-pulse rounded-xl bg-paper" />
            ) : !active || picking ? (
              <EventPicker
                events={events}
                reason={picking ? "change" : student.eventId ? "gone" : "none"}
                currentId={active?.event.id}
                onPick={(id) => {
                  setStudentEvent(id);
                  setChosen(null);
                  setPicking(false);
                }}
                onCancel={picking ? () => setPicking(false) : undefined}
              />
            ) : (
              <>
                {sessions.length > 1 ? (
                  <SelectField label="Session" value={active.session.id} onChange={(e) => setChosen(e.target.value)}>
                    {sessions.map((s) => (
                      <option key={s.session.id} value={s.session.id}>
                        {s.session.title} ({formatTime(s.session.time_in_start)})
                      </option>
                    ))}
                  </SelectField>
                ) : null}

                <div className={sessions.length > 1 ? "mt-4" : ""}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-lg font-semibold leading-snug">{active.event.title}</p>
                    <button type="button" onClick={() => setPicking(true)} className="press shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-brand-ink hover:bg-brand-tint">
                      Change event
                    </button>
                  </div>
                  <p className="text-sm text-ink-soft">{active.session.title}</p>
                  <p className="figures mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {active.event.venue}
                    </span>
                    <span>
                      {formatDay(active.session.time_in_start)} · in by {formatTime(graceEnds(active.session).toISOString())}
                    </span>
                  </p>
                  {active.state === "upcoming" && (
                    <p className="mt-3 rounded-lg bg-brand-tint px-3 py-2 text-sm text-brand-ink">
                      Time-in opens {OPENS_EARLY_MINS} minutes before the start, at{" "}
                      {formatTime(new Date(new Date(active.session.time_in_start).getTime() - OPENS_EARLY_MINS * 60000).toISOString())}.
                    </p>
                  )}
                </div>

                <div className="mt-5 border-t border-dashed border-line-strong pt-5">
                  <DynamicQRDisplay student={student} eventId={active.event.id} sessionId={active.session.id} />
                </div>
              </>
            )}
          </div>
        </article>

        <ul className="mt-6 space-y-3 text-sm text-ink-soft">
          <li className="flex gap-3">
            <Sun className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
            Turn your screen brightness up and hold the phone still about a hand’s length from the scanner.
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
            Your pass only works for this event and carries your name. Keep it to yourself; staff check it against you at the door.
          </li>
        </ul>
      </main>

      <StudentRegisterModal isOpen={editing} onClose={() => setEditing(false)} goToPass={false} />
    </div>
  );
}

/**
 * Lets a registered student choose (or switch) the event for their pass on
 * the pass page itself, instead of re-entering all their details.
 */
function EventPicker({
  events,
  reason,
  currentId,
  onPick,
  onCancel,
}: {
  events: BAEvent[];
  reason: "none" | "gone" | "change";
  currentId?: string;
  onPick: (eventId: string) => void;
  onCancel?: () => void;
}) {
  const options = useMemo(() => registrableEvents(events), [events]);
  // Default to the event taking attendance right now, else the next one.
  const suggested =
    options.find((e) => e.id !== currentId && e.sessions?.some((s) => sessionState(s) === "open"))?.id ?? options.find((e) => e.id !== currentId)?.id ?? options[0]?.id ?? "";
  const [picked, setPicked] = useState("");
  const value = options.some((e) => e.id === picked) ? picked : suggested;

  const heading = reason === "change" ? "Change event" : reason === "gone" ? "Your event is no longer open" : "Choose your event";
  const text =
    reason === "gone"
      ? "The event you registered for has ended or was removed. Choose the event you’re attending now."
      : "Your pass is made for the event you choose.";

  if (options.length === 0) {
    return (
      <div className="rounded-xl bg-paper p-6 text-center" role="status">
        <CalendarDays className="mx-auto h-7 w-7 text-muted" aria-hidden="true" />
        <p className="mt-3 font-semibold">No events are taking attendance</p>
        <p className="mt-1 text-sm text-ink-soft">This page checks again every minute. When the department publishes an event, you can choose it here.</p>
        {onCancel && (
          <button type="button" onClick={onCancel} className={`${btn.secondary} mt-4`}>
            Back to my pass
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      className="rounded-xl bg-paper p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) onPick(value);
      }}
    >
      <p className="font-semibold">{heading}</p>
      <p className="mt-1 text-sm text-ink-soft">{text}</p>
      <div className="mt-4">
        <SelectField label="Event" required value={value} onChange={(e) => setPicked(e.target.value)}>
          {options.map((ev) => {
            const openNow = ev.sessions?.some((s) => sessionState(s) === "open");
            return (
              <option key={ev.id} value={ev.id}>
                {ev.title} · {formatDay(ev.start_time)}
                {openNow ? " · open now" : ""}
              </option>
            );
          })}
        </SelectField>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} className={btn.secondary}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={!value} className={btn.primary}>
          Get my pass
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
