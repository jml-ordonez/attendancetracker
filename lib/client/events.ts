"use client";

import { useCallback, useEffect, useState } from "react";
import type { BAEvent } from "@/types/events";

/**
 * The public event list, shared by the registration dialog and the pass page
 * so opening one after the other doesn't fetch it twice.
 */
const FRESH_MS = 30_000;
let cache: { at: number; events: BAEvent[] } | null = null;
let inflight: Promise<BAEvent[]> | null = null;

function loadEvents(force: boolean): Promise<BAEvent[]> {
  if (!force && cache && Date.now() - cache.at < FRESH_MS) return Promise.resolve(cache.events);
  inflight ??= fetch("/api/events", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((d: { events: BAEvent[] }) => {
      cache = { at: Date.now(), events: d.events };
      return d.events;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Events from /api/events; `enabled` lets a closed dialog skip the request. */
export function useEvents(enabled = true) {
  const [events, setEvents] = useState<BAEvent[] | null>(() => cache?.events ?? null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadEvents(attempt > 0).then(
      (e) => {
        if (!live) return;
        setEvents(e);
        setError(false);
      },
      () => live && setError(true)
    );
    return () => {
      live = false;
    };
  }, [enabled, attempt]);

  const reload = useCallback(() => {
    setError(false);
    setAttempt((n) => n + 1);
  }, []);

  return { events, error, reload };
}
