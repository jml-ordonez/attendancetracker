"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, MapPin, ScanLine } from "lucide-react";
import { useAdminData } from "@/components/admin/AdminData";
import { PageHeader, PanelHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { btn, card } from "@/components/ui/styles";
import { api, usePolling } from "@/lib/client/api";
import { graceEnds, pickSession, publishedSessions, type SessionPick } from "@/lib/attendance/schedule";
import { formatDay, formatDuration, formatTime, formatTimeSeconds, isSameDay, plural, relativeTime } from "@/lib/format";
import { MAJOR_SHORT } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/lib/audit/store";
import type { AttendanceScan } from "@/types/attendance";

export function OverviewScreen() {
  const { scans, events, loaded, updatedAt } = useAdminData();
  const [activity, setActivity] = useState<AuditEntry[] | null>(null);

  usePolling(async () => {
    try {
      const data = await api<{ entries: AuditEntry[] }>("/api/audit?limit=6");
      setActivity(data.entries);
    } catch {}
  }, 8000);

  // The clock advances with each data refresh, so derived values stay stable between refreshes.
  const now = useMemo(() => updatedAt ?? new Date(0), [updatedAt]);
  const current = useMemo(() => (loaded ? pickSession(events, now) : null), [loaded, events, now]);

  const today = useMemo(() => scans.filter((s) => isSameDay(new Date(s.timestamp), now)), [scans, now]);

  const kpi = useMemo(() => {
    const ins = today.filter((s) => s.action === "time_in");
    const outs = today.filter((s) => s.action === "time_out");
    const onTime = ins.filter((s) => s.status === "on_time").length;
    const late = ins.length - onTime;
    const leftEarly = outs.filter((s) => s.status === "left_early").length;
    const outKeys = new Set(outs.map((s) => `${s.studentIdNumber}|${s.sessionId}`));
    const inside = ins.filter((s) => !outKeys.has(`${s.studentIdNumber}|${s.sessionId}`)).length;
    const stays = outs.map((s) => s.durationMinutes ?? 0);
    const avgStay = stays.length ? Math.round(stays.reduce((a, b) => a + b, 0) / stays.length) : 0;
    const manual = today.filter((s) => s.method === "manual").length;
    return { ins: ins.length, onTime, late, outs: outs.length, leftEarly, inside, avgStay, manual, total: today.length };
  }, [today]);

  const sessionScans = useMemo(
    () => (current ? scans.filter((s) => s.sessionId === current.session.id) : []),
    [scans, current]
  );

  const upcoming = useMemo(
    () => publishedSessions(events, now).filter((s) => s.state !== "ended" && s.session.id !== current?.session.id).slice(0, 3),
    [events, now, current]
  );

  const finding = !loaded
    ? "Loading today’s attendance…"
    : current?.state === "open"
      ? `${current.event.title} is open for attendance. ${plural(kpi.ins, "student")} checked in today${kpi.late ? `, ${kpi.late} late` : ""}.`
      : current?.state === "upcoming"
        ? `No session is open right now. Next: ${current.session.title}, ${formatDay(current.session.time_in_start)} at ${formatTime(current.session.time_in_start)}.`
        : "No upcoming sessions. Publish an event to open attendance.";

  return (
    <>
      <PageHeader
        title="Overview"
        description={finding}
        actions={
          <>
            <a href="/api/reports/export" download className={btn.secondary}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </a>
            <Link href="/admin/scanner" className={btn.primary}>
              <ScanLine className="h-4 w-4" aria-hidden="true" />
              Open scanner
            </Link>
          </>
        }
      />

      <div className="space-y-6">
        {current && <SessionBanner pick={current} scans={sessionScans} updatedAt={updatedAt} />}

        {/* KPI strip: one panel divided into cells, figures as type. */}
        <section aria-label="Today’s attendance" className={cn(card, "animate-rise overflow-hidden")} style={{ "--i": 2 } as React.CSSProperties}>
          <dl className="grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-x [&>div]:border-line max-lg:[&>div]:border-b">
            <Kpi label="Checked in today" value={loaded ? kpi.ins : null} sub={`${plural(kpi.inside, "student")} still inside`} />
            <Kpi
              label="On-time rate"
              value={loaded ? (kpi.ins ? `${Math.round((kpi.onTime / kpi.ins) * 100)}%` : "—") : null}
              sub={kpi.ins ? `${plural(kpi.late, "late arrival")}` : "No check-ins yet"}
              tone={kpi.ins && kpi.onTime / kpi.ins < 0.85 ? "warn" : undefined}
            />
            <Kpi label="Checked out" value={loaded ? kpi.outs : null} sub={kpi.leftEarly ? `${kpi.leftEarly} left early` : "None left early"} />
            <Kpi label="Average stay" value={loaded ? (kpi.outs ? formatDuration(kpi.avgStay) : "—") : null} sub={kpi.outs ? `Across ${plural(kpi.outs, "check-out")}` : "Shown after check-outs"} />
            <Kpi label="Manual entries" value={loaded ? kpi.manual : null} sub={`Of ${plural(kpi.total, "scan")} today`} />
          </dl>
        </section>

        <section className={cn(card, "animate-rise")} style={{ "--i": 3 } as React.CSSProperties} aria-labelledby="arrivals-h">
          <PanelHeader
            id="arrivals-h"
            title="Arrivals by quarter hour"
            description={current ? `${current.session.title} · check-ins against the grace period` : "Check-ins over time"}
          />
          <ArrivalsChart pick={current} scans={sessionScans} />
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className={cn(card, "animate-rise lg:col-span-2")} style={{ "--i": 5 } as React.CSSProperties} aria-labelledby="recent-h">
            <PanelHeader
              id="recent-h"
              title="Latest scans"
              description="Verified at the door, newest first"
              action={
                <Link href="/admin/records" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  All records <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
            <RecentScans scans={scans.slice(0, 6)} loaded={loaded} />
          </section>

          <section className={cn(card, "animate-rise flex flex-col")} style={{ "--i": 6 } as React.CSSProperties} aria-labelledby="activity-h">
            <PanelHeader
              id="activity-h"
              title="Recent activity"
              description="From the audit log"
              action={
                <Link href="/admin/audit-log" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  Audit log <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
            <ActivityList entries={activity} />
          </section>
        </div>

        {upcoming.length > 0 && (
          <section aria-labelledby="upcoming-h" className="animate-rise" style={{ "--i": 7 } as React.CSSProperties}>
            <div className="mb-3 flex items-end justify-between">
              <h2 id="upcoming-h" className="text-base font-semibold">
                Coming up
              </h2>
              <Link href="/admin/events" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                Manage events <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            <ul className="grid gap-4 md:grid-cols-3">
              {upcoming.map(({ event, session }) => (
                <li key={session.id} className={cn(card, "p-5")}>
                  <p className="text-sm font-semibold text-brand">{formatDay(session.time_in_start)}</p>
                  <p className="mt-1 font-display text-lg font-semibold leading-snug">{event.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">{session.title}</p>
                  <p className="figures mt-3 flex items-center gap-1.5 text-sm text-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{event.venue}</span>
                  </p>
                  <p className="figures mt-1 text-sm text-muted">
                    Check-in {formatTime(session.time_in_start)}–{formatTime(session.time_in_end)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode | null; sub: string; tone?: "warn" }) {
  return (
    <div className="px-5 py-5 sm:px-6">
      <dt className="text-[13px] font-medium text-muted">{label}</dt>
      <dd className={cn("figures mt-2 font-display text-[1.875rem] font-semibold leading-none tracking-tight", tone === "warn" ? "text-brass" : "text-ink")}>
        {value ?? <span className="inline-block h-7 w-14 animate-pulse rounded bg-paper align-middle" aria-label="Loading" />}
      </dd>
      <dd className="mt-2 text-[13px] text-ink-soft">{sub}</dd>
    </div>
  );
}

function SessionBanner({ pick, scans, updatedAt }: { pick: SessionPick; scans: AttendanceScan[]; updatedAt: Date | null }) {
  const { event, session, state } = pick;
  const start = new Date(session.time_in_start).getTime();
  const end = new Date(session.time_out_end).getTime();
  const now = (updatedAt ?? new Date()).getTime();
  const progress = Math.min(1, Math.max(0, (now - start) / (end - start)));
  const ins = scans.filter((s) => s.action === "time_in").length;
  const outs = scans.filter((s) => s.action === "time_out").length;

  return (
    <section
      aria-label="Current session"
      className="animate-rise overflow-hidden rounded-xl border border-brand/20 bg-brand-tint"
      style={{ "--i": 1 } as React.CSSProperties}
    >
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand">
            {state === "open" ? (
              <>
                <span className="live-dot text-brand" aria-hidden="true" /> Open for attendance
              </>
            ) : state === "upcoming" ? (
              `Next session · ${formatDay(session.time_in_start)}`
            ) : (
              `Last session · ${formatDay(session.time_in_start)}`
            )}
          </p>
          <h2 className="mt-2 font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-ink">{event.title}</h2>
          <p className="mt-1 text-[15px] text-ink-soft">
            {session.title} · {event.venue}
          </p>
        </div>

        <div>
          <dl className="figures grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Check-in</dt>
              <dd className="mt-0.5 font-semibold">
                {formatTime(session.time_in_start)}–{formatTime(session.time_in_end)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Late after</dt>
              <dd className="mt-0.5 font-semibold">{formatTime(graceEnds(session).toISOString())}</dd>
            </div>
            <div>
              <dt className="text-muted">Check-out</dt>
              <dd className="mt-0.5 font-semibold">
                {formatTime(session.time_out_start)}–{formatTime(session.time_out_end)}
              </dd>
            </div>
          </dl>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-brand/15" aria-hidden="true">
            <div className="animate-grow-x h-full rounded-full bg-brand" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="figures mt-2 flex justify-between text-[13px] text-ink-soft">
            <span>
              {plural(ins, "check-in")} · {plural(outs, "check-out")}
            </span>
            {updatedAt && <span className="text-muted">Updated {formatTimeSeconds(updatedAt.toISOString())}</span>}
          </p>
        </div>
      </div>
    </section>
  );
}

const BUCKET_MIN = 15;

function ArrivalsChart({ pick, scans }: { pick: SessionPick | null; scans: AttendanceScan[] }) {
  const ins = scans.filter((s) => s.action === "time_in");

  const { buckets, max, graceIndex } = useMemo(() => {
    if (!pick) return { buckets: [], max: 0, graceIndex: -1 };
    const start = new Date(pick.session.time_in_start).getTime() - 60 * 60000;
    const latest = Math.max(new Date(pick.session.time_in_end).getTime() + 30 * 60000, ...ins.map((s) => new Date(s.timestamp).getTime()));
    const count = Math.min(24, Math.max(8, Math.ceil((latest - start) / (BUCKET_MIN * 60000))));
    const b = Array.from({ length: count }, (_, i) => ({ at: new Date(start + i * BUCKET_MIN * 60000), onTime: 0, late: 0 }));
    for (const s of ins) {
      const i = Math.floor((new Date(s.timestamp).getTime() - start) / (BUCKET_MIN * 60000));
      const slot = b[Math.min(count - 1, Math.max(0, i))];
      if (s.status === "late") slot.late++;
      else slot.onTime++;
    }
    const grace = graceEnds(pick.session).getTime();
    return {
      buckets: b,
      max: Math.max(4, ...b.map((x) => x.onTime + x.late)),
      graceIndex: (grace - start) / (BUCKET_MIN * 60000),
    };
  }, [pick, ins]);

  if (!pick) return <p className="px-6 pb-6 pt-4 text-sm text-muted">No published session to chart.</p>;

  const ticks = [0, Math.ceil(max / 2), max];
  const lateTotal = ins.filter((s) => s.status === "late").length;

  return (
    <div className="px-5 pb-5 pt-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand" aria-hidden="true" /> On time ({ins.length - lateTotal})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#d98a1c]" aria-hidden="true" /> Late ({lateTotal})
        </span>
      </div>
      <div className="relative flex h-52 gap-3">
        {/* y axis */}
        <div className="figures flex w-6 flex-col-reverse justify-between pb-6 text-right text-[11px] text-muted" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="leading-none">
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden="true">
            {ticks.map((t) => (
              <div key={t} className="border-t border-dashed border-line" />
            ))}
          </div>
          {/* grace cutoff */}
          {graceIndex > 0 && graceIndex < buckets.length && (
            <div
              className="pointer-events-none absolute top-0 bottom-6 border-l-2 border-dashed border-[#d98a1c]/70"
              style={{ left: `${(graceIndex / buckets.length) * 100}%` }}
              aria-hidden="true"
            >
              <span className="absolute -top-0.5 left-1.5 whitespace-nowrap rounded bg-brass-soft px-1.5 py-0.5 text-[11px] font-medium text-brass">
                Late after {formatTime(graceEnds(pick.session).toISOString())}
              </span>
            </div>
          )}
          <ol className="absolute inset-x-0 top-0 bottom-6 flex items-end gap-[3px]" aria-label="Check-ins per 15 minutes">
            {buckets.map((b, i) => {
              const total = b.onTime + b.late;
              return (
                <li
                  key={b.at.toISOString()}
                  className="flex h-full flex-1 flex-col justify-end"
                  aria-label={`${formatTime(b.at.toISOString())}: ${total} check-in${total === 1 ? "" : "s"}`}
                  title={`${formatTime(b.at.toISOString())} · ${b.onTime} on time, ${b.late} late`}
                >
                  <div className="animate-grow-y flex flex-col justify-end overflow-hidden rounded-t-[3px]" style={{ height: `${(total / max) * 100}%`, "--i": i } as React.CSSProperties}>
                    {b.late > 0 && <div className="bg-[#d98a1c]" style={{ flexGrow: b.late }} />}
                    {b.onTime > 0 && <div className="bg-brand" style={{ flexGrow: b.onTime }} />}
                  </div>
                  {total === 0 && <div className="h-px bg-line-strong" />}
                </li>
              );
            })}
          </ol>
          {/* x labels: every hour */}
          <div className="figures absolute inset-x-0 bottom-0 flex h-5 text-[11px] text-muted" aria-hidden="true">
            {buckets.map((b) => (
              <span key={b.at.toISOString()} className="flex-1 truncate">
                {b.at.getMinutes() === 0 ? formatTime(b.at.toISOString()) : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      {ins.length === 0 && <p className="mt-3 text-sm text-muted">No check-ins for this session yet. Bars appear as students are scanned.</p>}
    </div>
  );
}


function RecentScans({ scans, loaded }: { scans: AttendanceScan[]; loaded: boolean }) {
  if (!loaded) return <div className="m-6 h-40 animate-pulse rounded-lg bg-paper" />;
  if (scans.length === 0)
    return (
      <p className="px-6 pb-8 pt-6 text-sm text-muted">
        No scans yet. Scans verified at the door appear here within seconds.{" "}
        <Link href="/admin/scanner" className="font-semibold text-brand hover:underline">
          Open the scanner
        </Link>
      </p>
    );

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Latest scans</caption>
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th scope="col" className="px-5 py-2.5 font-medium sm:px-6">Student</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Program</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium sm:px-6">Time</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((s) => (
            <tr key={s.id} className="animate-row-new border-b border-line last:border-0">
              <td className="px-5 py-3 sm:px-6">
                <div className="font-semibold text-ink">{s.studentName}</div>
                <div className="figures text-xs text-muted">{s.studentIdNumber}</div>
              </td>
              <td className="hidden px-3 py-3 text-ink-soft md:table-cell">
                {MAJOR_SHORT[s.majorCode] ?? s.majorCode} · {s.section}
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={s.status} label={s.action === "time_in" ? (s.status === "late" ? "Late in" : "In · on time") : s.status === "left_early" ? "Out · early" : "Out"} />
              </td>
              <td className="figures px-5 py-3 text-right text-ink-soft sm:px-6">{formatTime(s.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityList({ entries }: { entries: AuditEntry[] | null }) {
  if (!entries) return <div className="m-6 h-40 animate-pulse rounded-lg bg-paper" />;
  if (entries.length === 0) return <p className="px-6 pb-6 pt-4 text-sm text-muted">Nothing recorded yet.</p>;
  return (
    <ol className="mt-3 flex-1 px-5 pb-4 sm:px-6">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3 border-b border-line py-2.5 last:border-0">
          <span
            className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", e.outcome === "failure" ? "bg-rose" : "bg-brand")}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm leading-snug text-ink">{e.summary}</p>
            <p className="mt-0.5 text-xs text-muted">
              {e.actor} · {relativeTime(e.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
