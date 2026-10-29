"use client";

import React, { useMemo, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Info, LogIn, LogOut } from "lucide-react";
import { useAdminData } from "@/components/admin/AdminData";
import { PageHeader } from "@/components/admin/PageHeader";
import { SessionSelect } from "@/components/admin/SessionSelect";
import { QRScanner, type ScanMode } from "@/components/scanner/QRScanner";
import { ManualEntryModal } from "@/components/scanner/ManualEntryModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { card } from "@/components/ui/styles";
import { graceEnds, pickSession, sessionState, OPENS_EARLY_MINS } from "@/lib/attendance/schedule";
import { formatDateTime, formatTime, plural } from "@/lib/format";
import { MAJOR_SHORT } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { TokenPurpose } from "@/types/qr";

export function ScannerScreen() {
  const { events, scans, loaded, refreshScans } = useAdminData();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<TokenPurpose>("time_in");
  const [mode, setMode] = useState<ScanMode>("auto");
  const [manualOpen, setManualOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fallback = useMemo(() => pickSession(events), [events]);
  const pick = useMemo(() => {
    if (!chosenId) return fallback;
    for (const event of events) {
      const session = event.sessions?.find((s) => s.id === chosenId);
      if (session) return { event, session, state: sessionState(session) };
    }
    return fallback;
  }, [chosenId, events, fallback]);

  const sessionScans = useMemo(() => (pick ? scans.filter((s) => s.sessionId === pick.session.id) : []), [scans, pick]);
  const ins = sessionScans.filter((s) => s.action === "time_in").length;
  const outs = sessionScans.filter((s) => s.action === "time_out").length;

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 4000);
  };

  return (
    <>
      <PageHeader
        title="Scanner"
        description="Hold each student’s pass up to the camera. The first scan checks them in and the same pass scanned later checks them out, each checked against the session schedule."
      />

      <div className="space-y-5">
        <section className={cn(card, "animate-rise grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end")} style={{ "--i": 1 } as React.CSSProperties} aria-label="Scanner settings">
          {loaded ? (
            <SessionSelect events={events} value={pick?.session.id} onChange={(p) => setChosenId(p.session.id)} />
          ) : (
            <div className="h-[4.25rem] animate-pulse rounded-lg bg-paper" />
          )}
          <div className="flex flex-wrap gap-5">
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink" id="mode-label">
                Camera scans record
              </p>
              <div role="radiogroup" aria-labelledby="mode-label" className="grid grid-cols-3 gap-1 rounded-lg bg-paper p-1">
                {(
                  [
                    ["auto", "Auto", ArrowLeftRight],
                    ["time_in", "Time-in", LogIn],
                    ["time_out", "Time-out", LogOut],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    onClick={() => setMode(value)}
                    className={cn(
                      "press flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold",
                      mode === value ? "bg-brand text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink" id="purpose-label">
                Manual entry records
              </p>
              <div role="radiogroup" aria-labelledby="purpose-label" className="grid grid-cols-2 gap-1 rounded-lg bg-paper p-1">
                {(
                  [
                    ["time_in", "Time-in", LogIn],
                    ["time_out", "Time-out", LogOut],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={purpose === value}
                    onClick={() => setPurpose(value)}
                    className={cn(
                      "press flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold",
                      purpose === value ? "bg-brand text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {pick && (
            <p className="text-sm text-muted lg:col-span-2">
              {mode === "auto"
                ? "Auto: a pass times in on its first scan and times out when scanned again at least a minute later. Use Time-out at the exit for students leaving soon after arriving."
                : mode === "time_in"
                  ? "Time-in only: every scan records an arrival. Passes that already timed in are refused."
                  : "Time-out only: every scan records a departure, even right after the time-in."}
            </p>
          )}

          {pick && (
            <div className="figures flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft lg:col-span-2">
              <span>{pick.event.venue}</span>
              <span>
                Time-in {formatTime(pick.session.time_in_start)}–{formatTime(pick.session.time_in_end)}
              </span>
              <span>Late after {formatTime(graceEnds(pick.session).toISOString())}</span>
              <span>
                Time-out {formatTime(pick.session.time_out_start)}–{formatTime(pick.session.time_out_end)}
              </span>
              <span className="font-semibold text-ink">
                {plural(ins, "time-in")} · {plural(outs, "time-out")}
              </span>
            </div>
          )}
        </section>

        {pick && pick.state !== "open" && (
          <p className="flex items-start gap-2 rounded-lg bg-brass-soft px-4 py-3 text-sm text-brass" role="status">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {pick.state === "upcoming"
              ? `This session isn’t open yet. Time-in opens ${OPENS_EARLY_MINS} minutes before it starts, at ${formatDateTime(new Date(new Date(pick.session.time_in_start).getTime() - OPENS_EARLY_MINS * 60000).toISOString())}. Scans before then are refused.`
              : "This session has ended. Time-ins are refused; time-outs are still accepted."}
          </p>
        )}

        {toast && (
          <p className="animate-pop flex items-center gap-2 rounded-lg bg-pine-soft px-4 py-3 text-sm font-medium text-pine" role="status">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {toast}
          </p>
        )}

        {pick ? (
          <div className="animate-rise" style={{ "--i": 2 } as React.CSSProperties}>
            <QRScanner
              eventId={pick.event.id}
              sessionId={pick.session.id}
              mode={mode}
              onScanned={(r) => r.success && refreshScans()}
              onOpenManualEntry={() => setManualOpen(true)}
            />
          </div>
        ) : (
          loaded && (
            <p className={cn(card, "p-6 text-sm text-ink-soft")}>
              There is no published event to scan for. Publish one on the Events screen first.
            </p>
          )
        )}

        {pick && sessionScans.length > 0 && (
          <section className={card} aria-labelledby="session-scans-h">
            <h2 id="session-scans-h" className="px-5 pt-5 text-base font-semibold sm:px-6">
              This session
            </h2>
            <ul className="mt-2">
              {sessionScans.slice(0, 8).map((s) => (
                <li key={s.id} className="animate-row-new flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.studentName}</p>
                    <p className="figures truncate text-xs text-muted">
                      {s.studentIdNumber} · {MAJOR_SHORT[s.majorCode]} · {s.method === "manual" ? "manual entry" : "QR"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={s.status} label={s.action === "time_in" ? (s.status === "late" ? "Late in" : "In") : s.status === "left_early" ? "Out · early" : "Out"} />
                    <span className="figures w-16 text-right text-sm text-ink-soft">{formatTime(s.timestamp)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {pick && (
        <ManualEntryModal
          isOpen={manualOpen}
          onClose={() => setManualOpen(false)}
          eventId={pick.event.id}
          sessionId={pick.session.id}
          sessionLabel={`${pick.event.title} · ${pick.session.title}`}
          purpose={purpose}
          onSuccess={(msg) => {
            flash(msg);
            refreshScans();
          }}
        />
      )}
    </>
  );
}
