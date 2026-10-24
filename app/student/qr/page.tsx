"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, PencilLine, ShieldCheck, Sun } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { SelectField } from "@/components/ui/Field";
import { btn } from "@/components/ui/styles";
import { DynamicQRDisplay } from "@/components/student/DynamicQRDisplay";
import { StudentRegisterModal } from "@/components/auth/StudentRegisterModal";
import { useRegisteredStudent } from "@/lib/auth/session";
import { graceEnds, OPENS_EARLY_MINS, pickSession, publishedSessions } from "@/lib/attendance/schedule";
import { formatDay, formatTime } from "@/lib/format";
import { MAJOR_SHORT } from "@/lib/validation";
import type { BAEvent } from "@/types/events";

export default function StudentQRPage() {
  const student = useRegisteredStudent();
  const [editing, setEditing] = useState(false);
  const [events, setEvents] = useState<BAEvent[] | null>(null);
  const [eventsError, setEventsError] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/events", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setEvents(d.events))
      .catch(() => setEventsError(true));
  }, []);

  const sessions = useMemo(() => (events ? publishedSessions(events).filter((s) => s.state !== "ended") : []), [events]);
  const pick = useMemo(() => sessions.find((s) => s.session.id === chosen) ?? (events ? pickSession(events) : null), [sessions, chosen, events]);
  const active = pick && pick.state !== "ended" ? pick : sessions[0] ?? null;

  if (student === undefined) return <div className="min-h-dvh bg-paper" aria-busy="true" />;

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
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="BA Attendance home">
            <BrandMark className="h-8 w-8" />
            <span className="font-display text-[15px] font-semibold">BA Attendance</span>
          </Link>
          <button type="button" onClick={() => setEditing(true)} className={btn.ghost}>
            <PencilLine className="h-4 w-4" aria-hidden="true" />
            Edit details
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-12 pt-6">
        <h1 className="sr-only">Your attendance pass</h1>

        <article className="animate-rise overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(11,27,54,0.05),0_18px_40px_-20px_rgba(14,42,107,0.35)]">
          {/* Pass header: who this pass belongs to. */}
          <div className="bg-brand-deep px-6 py-5 text-white">
            <p className="text-sm text-white/70">Attendance pass</p>
            <p className="mt-1 font-display text-[1.625rem] font-semibold leading-tight">{student.fullName}</p>
            <p className="figures mt-1 text-[15px] text-white/85">
              {student.studentIdNumber} · {student.section}
            </p>
            <p className="text-sm text-white/70">
              {MAJOR_SHORT[student.majorCode]} Management · {student.yearLevel}
            </p>
          </div>

          <div className="p-5 sm:p-6">
            {eventsError ? (
              <p className="rounded-lg bg-rose-soft px-4 py-3 text-sm font-medium text-rose" role="alert">
                Couldn’t load events. Check your connection and reload the page.
              </p>
            ) : !events ? (
              <div className="h-80 animate-pulse rounded-xl bg-paper" />
            ) : !active ? (
              <div className="rounded-xl bg-paper p-6 text-center">
                <CalendarDays className="mx-auto h-7 w-7 text-muted" aria-hidden="true" />
                <p className="mt-3 font-semibold">No events are taking attendance</p>
                <p className="mt-1 text-sm text-ink-soft">When the department publishes an event, it appears here and you can show your pass.</p>
              </div>
            ) : (
              <>
                {sessions.length > 1 ? (
                  <SelectField label="Event" value={active.session.id} onChange={(e) => setChosen(e.target.value)}>
                    {sessions.map((s) => (
                      <option key={s.session.id} value={s.session.id}>
                        {s.event.title} · {s.session.title} ({formatDay(s.session.time_in_start)})
                      </option>
                    ))}
                  </SelectField>
                ) : null}

                <div className={sessions.length > 1 ? "mt-4" : ""}>
                  <p className="font-display text-lg font-semibold leading-snug">{active.event.title}</p>
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
                    <p className="mt-3 rounded-lg bg-brand-tint px-3 py-2 text-sm text-brand-dark">
                      Check-in opens {OPENS_EARLY_MINS} minutes before the start, at{" "}
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
            <Sun className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            Turn your screen brightness up and hold the phone still about a hand’s length from the scanner.
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            Each code works once and only for this event. Screenshots and shared codes are refused at the door.
          </li>
        </ul>
      </main>

      <StudentRegisterModal isOpen={editing} onClose={() => setEditing(false)} goToPass={false} />
    </div>
  );
}
