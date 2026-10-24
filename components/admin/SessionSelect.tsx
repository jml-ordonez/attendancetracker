"use client";

import React, { useMemo } from "react";
import { SelectField } from "@/components/ui/Field";
import { publishedSessions, type SessionPick } from "@/lib/attendance/schedule";
import { formatDay, formatTime } from "@/lib/format";
import type { BAEvent } from "@/types/events";

const STATE_LABEL = { open: "open now", upcoming: "upcoming", ended: "ended" } as const;

/** Picks a session of a published event; options are grouped by event and say whether each is open. */
export function SessionSelect({
  events,
  value,
  onChange,
  label = "Session",
}: {
  events: BAEvent[];
  value?: string;
  onChange: (pick: SessionPick) => void;
  label?: string;
}) {
  const sessions = useMemo(() => publishedSessions(events), [events]);
  const byEvent = useMemo(() => {
    const groups = new Map<string, SessionPick[]>();
    for (const s of sessions) groups.set(s.event.id, [...(groups.get(s.event.id) ?? []), s]);
    return [...groups.values()];
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <SelectField label={label} disabled value="">
        <option value="">No published sessions</option>
      </SelectField>
    );
  }

  return (
    <SelectField
      label={label}
      value={value ?? ""}
      onChange={(e) => {
        const pick = sessions.find((s) => s.session.id === e.target.value);
        if (pick) onChange(pick);
      }}
    >
      {byEvent.map((group) => (
        <optgroup key={group[0].event.id} label={group[0].event.title}>
          {group.map(({ session, state }) => (
            <option key={session.id} value={session.id}>
              {session.title} · {formatDay(session.time_in_start)}, {formatTime(session.time_in_start)} ({STATE_LABEL[state]})
            </option>
          ))}
        </optgroup>
      ))}
    </SelectField>
  );
}
