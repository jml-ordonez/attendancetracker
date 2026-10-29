"use client";

import React, { useMemo, useState } from "react";
import { Loader2, PencilLine } from "lucide-react";
import { useAdminData } from "@/components/admin/AdminData";
import { PageHeader } from "@/components/admin/PageHeader";
import { SessionSelect } from "@/components/admin/SessionSelect";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextAreaField } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { btn, card } from "@/components/ui/styles";
import { api, ApiError } from "@/lib/client/api";
import { buildRoll } from "@/lib/attendance/roll";
import { pickSession, sessionState } from "@/lib/attendance/schedule";
import { formatDuration, formatTime, plural } from "@/lib/format";
import { MAJOR_SHORT } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { CorrectedStatus, RollEntry } from "@/types/attendance";

type View = "all" | "inside" | "late" | "left_early" | "corrected";

const STATUS_OPTIONS: [CorrectedStatus, string][] = [
  ["present", "Present"],
  ["late", "Late"],
  ["checked_out", "Timed out"],
  ["left_early", "Left early"],
  ["excused", "Excused"],
];

/** The coordinator's desk: the live roll for one session, and corrections with a reason on record. */
export function CoordinatorScreen() {
  const { events, scans, loaded, refreshScans } = useAdminData();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [editing, setEditing] = useState<RollEntry | null>(null);

  const fallback = useMemo(() => pickSession(events), [events]);
  const pick = useMemo(() => {
    if (!chosenId) return fallback;
    for (const event of events) {
      const session = event.sessions?.find((s) => s.id === chosenId);
      if (session) return { event, session, state: sessionState(session) };
    }
    return fallback;
  }, [chosenId, events, fallback]);

  const roll = useMemo(() => (pick ? buildRoll(scans.filter((s) => s.sessionId === pick.session.id)) : []), [scans, pick]);
  const minStay = pick?.event.min_attendance_duration_mins ?? 0;

  const stats = useMemo(
    () => ({
      total: roll.length,
      inside: roll.filter((r) => !r.timeOut && r.finalStatus !== "excused").length,
      out: roll.filter((r) => r.timeOut).length,
      late: roll.filter((r) => r.finalStatus === "late" || r.timeInStatus === "late").length,
      early: roll.filter((r) => r.finalStatus === "left_early").length,
      corrected: roll.filter((r) => r.correction).length,
    }),
    [roll]
  );

  const rows = roll.filter((r) =>
    view === "inside" ? !r.timeOut : view === "late" ? r.timeInStatus === "late" : view === "left_early" ? r.finalStatus === "left_early" : view === "corrected" ? !!r.correction : true
  );

  return (
    <>
      <PageHeader
        title="Coordinator view"
        description="The roll for one session: who is inside, who left early, and who needs a correction. Every correction is kept with its reason."
      />

      <section className={cn(card, "animate-rise mb-6 p-5 sm:p-6")} style={{ "--i": 1 } as React.CSSProperties} aria-label="Session">
        <div className="max-w-xl">
          {loaded ? <SessionSelect events={events} value={pick?.session.id} onChange={(p) => setChosenId(p.session.id)} /> : <div className="h-[4.25rem] animate-pulse rounded-lg bg-paper" />}
        </div>
        {pick && (
          <dl className="figures mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ["On the roll", stats.total],
                ["Still inside", stats.inside],
                ["Timed out", stats.out],
                ["Arrived late", stats.late],
                ["Left early", stats.early],
                ["Corrected", stats.corrected],
              ] as const
            ).map(([label, n]) => (
              <div key={label}>
                <dt className="text-[13px] font-medium text-muted">{label}</dt>
                <dd className="mt-1 font-display text-[1.625rem] font-semibold leading-none">{n}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className={cn(card, "animate-rise")} style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="roll-h">
        <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 id="roll-h" className="text-base font-semibold">
              Session roll
            </h2>
            <p className="text-sm text-muted">
              {minStay > 0
                ? `Certificate needs a stay of ${formatDuration(minStay)} or an excuse.`
                : "Certificate needs a time-in and an on-time time-out, or an excuse."}
            </p>
          </div>
          <div role="tablist" aria-label="Filter the roll" className="flex flex-wrap gap-1">
            {(
              [
                ["all", "All"],
                ["inside", "Inside"],
                ["late", "Late"],
                ["left_early", "Left early"],
                ["corrected", "Corrected"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={cn("press h-9 rounded-md px-3 text-sm font-semibold", view === value ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:bg-paper")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-ink-soft">
            {roll.length === 0 ? "No one has timed in to this session yet." : "No students in this group."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Session roll</caption>
              <thead className="bg-paper/70 text-xs uppercase tracking-wide text-muted">
                <tr className="border-y border-line">
                  <th scope="col" className="px-6 py-3 font-medium">Student</th>
                  <th scope="col" className="px-3 py-3 font-medium">Program</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">In</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Out</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Stay</th>
                  <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  <th scope="col" className="px-3 py-3 font-medium">Certificate</th>
                  <th scope="col" className="px-6 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const eligible = r.finalStatus === "excused" || (r.timeOut && r.finalStatus !== "left_early" && r.durationMinutes >= minStay);
                  return (
                    <tr key={r.key} className="border-b border-line last:border-0 hover:bg-brand-tint/60">
                      <td className="px-6 py-3">
                        <div className="font-semibold">{r.studentName}</div>
                        <div className="figures text-xs text-muted">{r.studentIdNumber}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{MAJOR_SHORT[r.majorCode]}</div>
                        <div className="text-xs text-muted">{r.section}</div>
                      </td>
                      <td className="figures px-3 py-3 text-right">{formatTime(r.timeIn)}</td>
                      <td className="figures px-3 py-3 text-right">{r.timeOut ? formatTime(r.timeOut) : <span className="text-muted">Inside</span>}</td>
                      <td className="figures px-3 py-3 text-right">{formatDuration(r.timeOut ? r.durationMinutes : undefined)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={r.finalStatus} />
                        {r.correction && (
                          <p className="mt-1 max-w-[14rem] truncate text-xs text-brand-ink" title={r.correction.reason}>
                            Corrected by {r.correction.by}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-ink-soft">{eligible ? "Eligible" : r.timeOut ? "Not eligible" : "Pending time-out"}</td>
                      <td className="px-6 py-3 text-right">
                        {r.timeInScanId && (
                          <button type="button" onClick={() => setEditing(r)} className={btn.small}>
                            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                            Correct
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="figures border-t border-line px-6 py-3 text-sm text-muted">{plural(rows.length, "student")} shown</p>
      </section>

      <CorrectionModal
        entry={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refreshScans();
        }}
      />
    </>
  );
}

function CorrectionModal({ entry, onClose, onSaved }: { entry: RollEntry | null; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<CorrectedStatus>("excused");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ status?: string; reason?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [forKey, setForKey] = useState<string | null>(null);

  // Reset the form when a different student is opened.
  if (entry && entry.key !== forKey) {
    setForKey(entry.key);
    setStatus(entry.finalStatus === "excused" ? "present" : "excused");
    setReason("");
    setErrors({});
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry?.timeInScanId || saving) return;
    if (reason.trim().length < 10) {
      setErrors({ reason: "Give a reason of at least 10 characters, such as the excuse letter or the verified evidence." });
      return;
    }
    if (status === entry.finalStatus) {
      setErrors({ status: "Choose a status different from the current one." });
      return;
    }
    setSaving(true);
    try {
      await api(`/api/attendance/records/${entry.timeInScanId}`, { method: "PATCH", json: { status, reason: reason.trim() } });
      onSaved();
    } catch (err) {
      setErrors(err instanceof ApiError ? { ...err.fieldErrors, form: err.message } : { form: "No connection to the server." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      size="md"
      title="Correct attendance"
      description={entry ? `${entry.studentName} (${entry.studentIdNumber}) · ${entry.sessionTitle}` : undefined}
    >
      {entry && (
        <form onSubmit={submit} noValidate className="space-y-5">
          {errors.form && (
            <p role="alert" className="rounded-lg bg-rose-soft px-3 py-2.5 text-sm font-medium text-rose">
              {errors.form}
            </p>
          )}
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            Currently <StatusBadge status={entry.finalStatus} />
          </p>
          <SelectField label="Correct to" value={status} error={errors.status} onChange={(e) => { setStatus(e.target.value as CorrectedStatus); setErrors({}); }}>
            {STATUS_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectField>
          <TextAreaField
            label="Reason"
            required
            rows={3}
            maxLength={300}
            placeholder="Excuse letter from the program chair: official varsity competition."
            value={reason}
            error={errors.reason}
            hint="Kept in the audit log with your name."
            onChange={(e) => {
              setReason(e.target.value);
              setErrors({});
            }}
          />
          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={btn.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btn.primary}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save correction
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
