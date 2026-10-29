"use client";

import React, { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { SelectField } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { btn, card, input } from "@/components/ui/styles";
import { api, usePolling } from "@/lib/client/api";
import { formatDateTime, formatTimeSeconds, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuditCategory, AuditEntry } from "@/lib/audit/store";

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  auth: "Sign-in",
  attendance: "Attendance",
  events: "Events",
  records: "Records",
  reports: "Reports",
};

const PAGE = 60;

export function AuditLogScreen() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState<"all" | AuditCategory>("all");
  const [outcome, setOutcome] = useState<"all" | "success" | "failure">("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const query = useDeferredValue(q.trim().toLowerCase());

  usePolling(async () => {
    try {
      const data = await api<{ entries: AuditEntry[]; total: number }>("/api/audit?limit=1000");
      setEntries(data.entries);
      setTotal(data.total);
    } catch {}
  }, 6000);

  const filtered = useMemo(
    () =>
      (entries ?? []).filter(
        (e) =>
          (category === "all" || e.category === category) &&
          (outcome === "all" || e.outcome === outcome) &&
          (!query || `${e.summary} ${e.actor} ${e.target ?? ""} ${e.ip ?? ""}`.toLowerCase().includes(query))
      ),
    [entries, category, outcome, query]
  );

  const failures = (entries ?? []).filter((e) => e.outcome === "failure").length;

  return (
    <>
      <PageHeader
        title="Audit log"
        description={
          entries
            ? `${plural(total, "action")} recorded since the server started${failures ? `, ${plural(failures, "failure")} among them` : ""}. Sign-ins, scans, manual entries, corrections, event changes and exports.`
            : "Loading the audit trail…"
        }
      />

      <section className={cn(card, "animate-rise")} style={{ "--i": 1 } as React.CSSProperties} aria-label="Audit entries">
        <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-end sm:p-6">
          <div>
            <label htmlFor="audit-q" className="mb-1.5 block text-sm font-medium">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input id="audit-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Person, student, event or IP address" className={cn(input, "pl-9")} />
            </div>
          </div>
          <SelectField label="Area" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            <option value="all">All areas</option>
            {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectField>
          <SelectField label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
            <option value="all">Any outcome</option>
            <option value="success">Succeeded</option>
            <option value="failure">Failed or refused</option>
          </SelectField>
        </div>

        {!entries ? (
          <div className="m-6 h-56 animate-pulse rounded-lg bg-paper" />
        ) : filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-ink-soft">{entries.length ? "No entries match these filters." : "Nothing recorded yet."}</p>
        ) : (
          <ol aria-label="Audit entries, newest first">
            {filtered.slice(0, shown).map((e) => {
              const expanded = open === e.id;
              const hasDetails = !!e.details && Object.keys(e.details).length > 0;
              return (
                <li key={e.id} className="border-b border-line last:border-0">
                  <div className="grid gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[9.5rem_minmax(0,1fr)_auto] sm:items-center sm:px-6">
                    <div className="figures text-sm text-ink-soft">
                      <time dateTime={e.at} title={formatDateTime(e.at)}>
                        {formatDateTime(e.at)}
                      </time>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        <span className="font-semibold">{e.actor}</span> <span className="text-muted">·</span> {e.summary}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {CATEGORY_LABEL[e.category]}
                        {e.target ? ` · ${e.target}` : ""}
                        {e.ip ? ` · IP ${e.ip}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={e.outcome} label={e.outcome === "success" ? "OK" : "Failed"} />
                      {hasDetails && (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpen(expanded ? null : e.id)}
                          className="press h-9 rounded-md px-2.5 text-sm font-semibold text-brand-ink hover:bg-brand-tint"
                        >
                          {expanded ? "Hide" : "Details"}
                        </button>
                      )}
                    </div>
                  </div>
                  {expanded && hasDetails && (
                    <dl className="animate-fade mx-5 mb-4 grid gap-x-6 gap-y-2 rounded-lg bg-paper p-4 text-sm sm:mx-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
                      <dt className="text-muted">Action</dt>
                      <dd className="break-words">{e.action}</dd>
                      <dt className="text-muted">Exact time</dt>
                      <dd className="figures">{formatTimeSeconds(e.at)}</dd>
                      {e.actorEmail && (
                        <>
                          <dt className="text-muted">Account</dt>
                          <dd className="break-words">{e.actorEmail}</dd>
                        </>
                      )}
                      {Object.entries(e.details!).map(([k, v]) => (
                        <React.Fragment key={k}>
                          <dt className="capitalize text-muted">{k.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}</dt>
                          <dd className="break-words">{v === null ? "—" : String(v)}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {entries && shown < filtered.length && (
          <div className="border-t border-line p-4 text-center">
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className={btn.small}>
              Show {Math.min(PAGE, filtered.length - shown)} more
            </button>
          </div>
        )}
      </section>
      <p className="mt-4 text-sm text-muted">
        The log is kept in server memory and is cleared when the server restarts. Entries can’t be edited or deleted from the console.
      </p>
    </>
  );
}
