"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, CheckCircle2, Info, Loader2, MapPin, Pencil, Trash2 } from "lucide-react";
import { useAdminData } from "@/components/admin/AdminData";
import { PageHeader } from "@/components/admin/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Field, TextAreaField } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { btn, card } from "@/components/ui/styles";
import { api, ApiError } from "@/lib/client/api";
import { sessionState } from "@/lib/attendance/schedule";
import { formatDay, formatTime, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ENDED_MESSAGE, eventInputSchema, eventUpdateSchema, fieldErrors } from "@/lib/validation";
import type { BAEvent } from "@/types/events";

type Filter = "upcoming" | "past" | "draft" | "all";

export function EventsScreen() {
  const { events, scans, loaded, updatedAt, refreshEvents, putEvent, dropEvent } = useAdminData();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BAEvent | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BAEvent | null>(null);

  const now = updatedAt?.getTime() ?? 0;
  const visible = useMemo(
    () =>
      events.filter((e) => {
        const ended = new Date(e.end_time).getTime() < now;
        if (filter === "upcoming") return !ended && e.status === "published";
        if (filter === "past") return ended && e.status !== "draft";
        if (filter === "draft") return e.status === "draft" || e.status === "cancelled";
        return true;
      }),
    [events, filter, now]
  );

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const s of scans) if (s.action === "time_in") c.set(s.eventId, (c.get(s.eventId) ?? 0) + 1);
    return c;
  }, [scans]);

  const setStatus = async (event: BAEvent, status: "published" | "draft" | "cancelled") => {
    setPending(event.id);
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ event: BAEvent }>(`/api/events/${event.id}`, { method: "PATCH", json: { status } });
      putEvent(res.event);
      setNotice(
        status === "published"
          ? `Published “${event.title}”. Students can get passes for it now.`
          : status === "draft"
            ? `Unpublished “${event.title}”. It's in Drafts and hidden from students.`
            : `Cancelled “${event.title}”. It's in Drafts; publish it again to restore it.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update the event.");
      // The event may have been deleted or changed elsewhere: show the current list.
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) void refreshEvents();
    } finally {
      setPending(null);
    }
  };

  /** The tab a saved event shows up in, so it never seems to disappear after saving. */
  const tabFor = (e: BAEvent): Filter =>
    e.status !== "published" ? "draft" : new Date(e.end_time).getTime() < Date.now() ? "past" : "upcoming";

  return (
    <>
      <PageHeader
        title="Events"
        description="Seminars, conferences and assemblies that take attendance. Students can only generate passes for published events."
        actions={
          <button type="button" onClick={() => setCreating(true)} className={btn.primary}>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            New event
          </button>
        }
      />

      <div role="tablist" aria-label="Filter events" className="animate-rise mb-5 inline-flex rounded-lg bg-card p-1 ring-1 ring-line" style={{ "--i": 1 } as React.CSSProperties}>
        {(
          [
            ["upcoming", "Upcoming"],
            ["past", "Past"],
            ["draft", "Drafts"],
            ["all", "All"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "press h-9 rounded-md px-4 text-sm font-semibold",
              filter === value ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:text-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-rose-soft px-4 py-3 text-sm font-medium text-rose">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="animate-pop mb-4 flex items-center gap-2 rounded-lg bg-pine-soft px-4 py-3 text-sm font-medium text-pine">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      {!loaded ? (
        <div className="h-64 animate-pulse rounded-xl bg-card" />
      ) : visible.length === 0 ? (
        <div className={cn(card, "p-8 text-center")}>
          <p className="text-sm text-ink-soft">
            {filter === "upcoming"
              ? "No upcoming published events. Create one, or publish a draft."
              : filter === "past"
                ? "No past events yet."
                : filter === "draft"
                  ? "No drafts or cancelled events."
                  : "No events yet."}
          </p>
          {(filter === "upcoming" || filter === "all") && (
            <button type="button" onClick={() => setCreating(true)} className={cn(btn.primary, "mt-4")}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              New event
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((e, i) => {
            const session = e.sessions?.[0];
            const open = e.status === "published" && e.sessions?.some((s) => sessionState(s) === "open");
            const ended = new Date(e.end_time).getTime() < now;
            const busy = pending === e.id;
            return (
              <li key={e.id} className={cn(card, "animate-rise grid gap-5 p-5 sm:p-6 md:grid-cols-[7rem_minmax(0,1fr)_auto]")} style={{ "--i": i + 2 } as React.CSSProperties}>
                <div className="figures">
                  <p className="text-sm font-semibold text-brand-ink">{formatDay(e.start_time).split(",")[0]}</p>
                  <p className="font-display text-[1.75rem] font-semibold leading-none">{new Date(e.start_time).getDate()}</p>
                  <p className="mt-1 text-sm text-muted">{new Date(e.start_time).toLocaleString("en-PH", { month: "short", year: "numeric" })}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {e.category && <span className="text-sm font-medium text-ink-soft">{e.category}</span>}
                    <StatusBadge status={e.status} />
                    {open && (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
                        <span className="live-dot" aria-hidden="true" /> Open now
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1.5 font-display text-xl font-semibold leading-snug">{e.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{e.description}</p>
                  <p className="figures mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {e.venue}
                    </span>
                    <span>
                      {formatTime(e.start_time)}–{formatTime(e.end_time)}
                    </span>
                    {session && <span>Late after {session.grace_period_mins} min grace</span>}
                    <span>{plural(e.sessions?.length ?? 0, "session")}</span>
                    <span className="font-medium text-ink-soft">{plural(counts.get(e.id) ?? 0, "time-in")}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2 md:flex-col md:items-stretch" aria-busy={busy}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setEditing(e);
                    }}
                    aria-label={`Edit ${e.title}`}
                    className={btn.small}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </button>
                  {e.status === "published" ? (
                    <button type="button" disabled={busy} onClick={() => setStatus(e, "draft")} className={btn.small}>
                      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      Unpublish
                    </button>
                  ) : ended ? (
                    <span className="px-1 py-1.5 text-sm text-muted">Ended · edit the date to publish</span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus(e, "published")}
                      className={cn(btn.small, "border-brand bg-brand text-ink hover:border-brand-dark hover:bg-brand-dark hover:text-ink")}
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {e.status === "cancelled" ? "Restore & publish" : "Publish"}
                    </button>
                  )}
                  {e.status !== "cancelled" && (
                    <button type="button" disabled={busy} onClick={() => setStatus(e, "cancelled")} className={cn(btn.small, "text-rose hover:border-rose hover:text-rose")}>
                      Cancel event
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setDeleting(e);
                    }}
                    aria-label={`Delete ${e.title}`}
                    className={cn(btn.small, "text-rose hover:border-rose hover:bg-rose-soft hover:text-rose")}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DeleteEventModal
        event={deleting}
        timeIns={deleting ? counts.get(deleting.id) ?? 0 : 0}
        onClose={() => setDeleting(null)}
        onDeleted={(id, title, kept) => {
          setDeleting(null);
          dropEvent(id);
          setNotice(`Deleted “${title}”.${kept ? ` Its ${plural(kept, "attendance record")} stay in Attendance records.` : ""}`);
          void refreshEvents();
        }}
        onGone={() => {
          setDeleting(null);
          void refreshEvents();
        }}
      />

      <EventFormModal
        open={creating || !!editing}
        event={editing}
        timeIns={editing ? counts.get(editing.id) ?? 0 : 0}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={(event, mode, changed) => {
          setCreating(false);
          setEditing(null);
          putEvent(event);
          setFilter(tabFor(event));
          setNotice(
            mode === "created"
              ? `Created “${event.title}”${event.status === "published" ? " and published it" : " as a draft"}.`
              : changed.length
                ? `Saved changes to “${event.title}” (${changed.join(", ")}).`
                : `No changes to “${event.title}”.`
          );
          void refreshEvents();
        }}
      />
    </>
  );
}

/** Confirms before deleting: names the event, warns when it is open, and says what happens to its records. */
function DeleteEventModal({
  event,
  timeIns,
  onClose,
  onDeleted,
  onGone,
}: {
  event: BAEvent | null;
  timeIns: number;
  onClose: () => void;
  onDeleted: (id: string, title: string, recordsKept: number) => void;
  /** The event was already deleted elsewhere. */
  onGone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  if ((event?.id ?? null) !== lastId) {
    setLastId(event?.id ?? null);
    setError(null);
    setBusy(false);
  }
  const open = !!event && event.status === "published" && event.sessions?.some((s) => sessionState(s) === "open");

  const confirm = async () => {
    if (!event || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ recordsKept: number }>(`/api/events/${event.id}`, { method: "DELETE" });
      onDeleted(event.id, event.title, data.recordsKept);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return onGone();
      setError(e instanceof Error ? e.message : "Couldn't delete the event. Try again.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!event}
      onClose={() => {
        if (!busy) onClose();
      }}
      size="md"
      title="Delete this event?"
      description={event ? `“${event.title}” · ${formatDay(event.start_time)}, ${formatTime(event.start_time)}` : undefined}
    >
      <div className="space-y-4 text-sm leading-relaxed text-ink-soft">
        {error && (
          <p role="alert" className="rounded-lg bg-rose-soft px-3 py-2.5 font-medium text-rose">
            {error}
          </p>
        )}
        {open && (
          <p className="flex items-start gap-2 rounded-lg bg-brass-soft px-3 py-2.5 font-medium text-brass">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            This event is taking attendance right now. Scans for it will stop working immediately.
          </p>
        )}
        <ul className="list-disc space-y-1 pl-5">
          <li>The event is removed from the list, the scanner and the student pass page.</li>
          <li>Passes already shown or downloaded for it will no longer be accepted.</li>
          <li>
            {timeIns > 0
              ? `Its ${plural(timeIns, "time-in")} and any time-outs stay in Attendance records and reports.`
              : "It has no attendance records."}
          </li>
        </ul>
        <p className="font-medium text-ink">This can’t be undone. To hide an event without deleting it, cancel or unpublish it instead.</p>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={busy} className={btn.secondary}>
          Keep event
        </button>
        <button type="button" onClick={confirm} disabled={busy} className={btn.dangerSolid}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          {busy ? "Deleting…" : "Delete event"}
        </button>
      </div>
    </Modal>
  );
}

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-10-24T08:00" (a datetime-local value) → "2026-10-24T08:00:00+08:00", in the browser's zone. */
function withOffset(local: string) {
  const off = -new Date(local).getTimezoneOffset();
  const abs = Math.abs(off);
  return `${local}:00${off >= 0 ? "+" : "-"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

type FormValues = { title: string; description: string; venue: string; start: string; end: string; gracePeriodMins: string; publish: boolean };
type FormErrors = Partial<Record<keyof FormValues | "form", string>>;

function blankForm(): FormValues {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 3 * 3600000);
  return { title: "", description: "", venue: "", start: localInput(start), end: localInput(end), gracePeriodMins: "15", publish: true };
}

function formFor(event: BAEvent): FormValues {
  return {
    title: event.title,
    description: event.description,
    venue: event.venue,
    start: localInput(new Date(event.start_time)),
    end: localInput(new Date(event.end_time)),
    gracePeriodMins: String(event.sessions?.[0]?.grace_period_mins ?? 15),
    publish: event.status === "published",
  };
}

const DESCRIPTION_MAX = 500;

/**
 * Creates an event, or edits one (`event` set), published or not. Validates
 * with the same schemas as the API, so the form and the server never disagree.
 */
function EventFormModal({
  open,
  event,
  timeIns,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The event being edited; absent when creating. */
  event?: BAEvent | null;
  timeIns: number;
  onClose: () => void;
  onSaved: (event: BAEvent, mode: "created" | "updated", changed: string[]) => void;
}) {
  const editing = !!event;
  const [f, setF] = useState<FormValues>(blankForm);
  const [initial, setInitial] = useState<FormValues>(blankForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Fresh values each time the dialog opens (or switches to another event).
  const scope = open ? (event?.id ?? "new") : null;
  const [lastScope, setLastScope] = useState<string | null>(null);
  if (scope !== lastScope) {
    setLastScope(scope);
    if (scope) {
      const values = event ? formFor(event) : blankForm();
      setF(values);
      setInitial(values);
      setErrors({});
      setSaving(false);
    }
  }

  const multiSession = (event?.sessions?.length ?? 0) > 1;
  const dirty = (Object.keys(f) as (keyof FormValues)[]).some((k) => f[k] !== initial[k]);
  const scheduleDirty = f.start !== initial.start || f.end !== initial.end || f.gracePeriodMins !== initial.gracePeriodMins;

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => (e[k] || e.form ? { ...e, [k]: undefined, form: undefined } : e));
  };

  /** Moving the start keeps the event's length, so the end never lands before it. */
  const setStart = (next: string) => {
    setF((p) => {
      const prevStart = new Date(p.start).getTime();
      const prevEnd = new Date(p.end).getTime();
      const nextStart = new Date(next).getTime();
      const keepLength = !!next && !Number.isNaN(prevStart) && !Number.isNaN(prevEnd) && !Number.isNaN(nextStart) && prevEnd > prevStart;
      return { ...p, start: next, end: keepLength ? localInput(new Date(nextStart + (prevEnd - prevStart))) : p.end };
    });
    setErrors((e) => ({ ...e, start: undefined, end: undefined, form: undefined }));
  };

  const close = () => {
    if (saving) return;
    if (dirty && !window.confirm(editing ? "Discard your changes to this event?" : "Discard this new event?")) return;
    onClose();
  };

  const validate = (): { data: Record<string, unknown> } | { errors: FormErrors } => {
    const base = {
      title: f.title,
      description: f.description,
      venue: f.venue,
      start: f.start ? withOffset(f.start) : "",
      end: f.end ? withOffset(f.end) : "",
      gracePeriodMins: f.gracePeriodMins.trim() === "" ? Number.NaN : Number(f.gracePeriodMins),
    };
    if (!event) {
      const r = eventInputSchema.safeParse({ ...base, publish: f.publish });
      return r.success ? { data: r.data } : { errors: fieldErrors(r.error) };
    }
    const r = eventUpdateSchema.safeParse({ ...base, expectedUpdatedAt: event.updated_at });
    if (!r.success) return { errors: fieldErrors(r.error) };
    // Fixing a finished event's details is fine; moving its schedule into the past is not.
    const timesMoved = f.start !== initial.start || f.end !== initial.end;
    if (timesMoved && new Date(r.data.end).getTime() <= Date.now()) return { errors: { end: ENDED_MESSAGE } };
    return { data: r.data };
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;
    if (editing && !dirty) return onClose();
    const result = validate();
    if ("errors" in result) {
      setErrors(result.errors);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus());
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (event) {
        const res = await api<{ event: BAEvent; changed: string[] }>(`/api/events/${event.id}`, { method: "PUT", json: result.data });
        onSaved(res.event, "updated", res.changed);
      } else {
        const res = await api<{ event: BAEvent }>("/api/events", { method: "POST", json: result.data });
        onSaved(res.event, "created", []);
      }
    } catch (err) {
      if (err instanceof ApiError) setErrors({ ...err.fieldErrors, form: Object.keys(err.fieldErrors).length ? undefined : err.message });
      else setErrors({ form: "No connection to the server. Nothing was saved; try again." });
      setSaving(false);
    }
  };

  const statusLabel = event ? (event.status === "published" ? "Published" : event.status === "cancelled" ? "Cancelled" : "Draft") : "";

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={editing ? "Edit event" : "New event"}
      description={
        event
          ? `${statusLabel} · created by ${event.organizer_name ?? "staff"}`
          : "Time-in opens at the start and time-out opens near the end. Students who time in after the grace period are marked late."
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {errors.form && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-soft px-3 py-2.5 text-sm font-medium text-rose">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {errors.form}
          </p>
        )}
        {event?.status === "published" && (
          <p className="flex items-start gap-2 rounded-lg bg-brand-tint px-3 py-2.5 text-sm text-brand-ink">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            This event is published. Students see your changes right away, and passes they already have keep working.
          </p>
        )}

        <Field label="Title" required maxLength={120} autoComplete="off" value={f.title} error={errors.title} onChange={(e) => set("title", e.target.value)} />
        <Field label="Venue" required maxLength={120} autoComplete="off" value={f.venue} error={errors.venue} onChange={(e) => set("venue", e.target.value)} />
        <TextAreaField
          label="Description"
          required
          rows={3}
          maxLength={DESCRIPTION_MAX}
          placeholder="Topics, which year levels attend, and what students should bring."
          value={f.description}
          error={errors.description}
          hint={`${f.description.trim().length}/${DESCRIPTION_MAX} characters`}
          onChange={(e) => set("description", e.target.value)}
        />

        <fieldset className="space-y-4" disabled={multiSession || saving}>
          <legend className="sr-only">Schedule</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Starts"
              required
              type="datetime-local"
              value={f.start}
              error={errors.start}
              onChange={(e) => setStart(e.target.value)}
            />
            <Field
              label="Ends"
              required
              type="datetime-local"
              min={f.start || undefined}
              value={f.end}
              error={errors.end}
              hint="Same day. Moving the start keeps the length."
              onChange={(e) => set("end", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Grace period (min)"
              required
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              step={1}
              value={f.gracePeriodMins}
              error={errors.gracePeriodMins}
              hint="Minutes after the start before a time-in counts as late."
              onChange={(e) => set("gracePeriodMins", e.target.value)}
            />
          </div>
        </fieldset>
        {multiSession && (
          <p className="text-sm text-muted">This event has several sessions, so its schedule can’t be changed here. The title, venue and description can.</p>
        )}
        {editing && scheduleDirty && timeIns > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-brass-soft px-3 py-2.5 text-sm font-medium text-brass">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {plural(timeIns, "student")} already timed in. The new schedule applies to new scans; recorded scans keep their status.
          </p>
        )}

        {!editing && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={f.publish} onChange={(e) => set("publish", e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
            <span>
              <span className="font-medium">Publish now</span>
              <span className="block text-muted">Students can generate passes for it straight away. Leave unticked to save a draft.</span>
            </span>
          </label>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end">
          {editing && !dirty && <span className="text-sm text-muted sm:mr-auto">No changes yet</span>}
          <button type="button" onClick={close} disabled={saving} className={btn.secondary}>
            Cancel
          </button>
          <button type="submit" disabled={saving || (editing && !dirty)} className={btn.primary}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : editing ? "Save changes" : f.publish ? "Create and publish" : "Save draft"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
