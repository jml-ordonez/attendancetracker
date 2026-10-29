"use client";

import { useCallback, useEffect, useState } from "react";
import type { BAEvent } from "@/types/events";

/**
 * The public event list, shared by the registration dialog and the pass page.
 * Requests made at the same moment share one fetch; every mount still asks the
 * server, so an event published a minute ago shows up straight away.
 */
const DEDUPE_MS = 3000;
/** While a page is open, re-check this often so newly published events appear. */
const REFRESH_MS = 60_000;

let cache: { at: number; events: BAEvent[] } | null = null;
let inflight: Promise<BAEvent[]> | null = null;

function loadEvents(): Promise<BAEvent[]> {
  if (cache && Date.now() - cache.at < DEDUPE_MS) return Promise.resolve(cache.events);
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

/**
 * Events from /api/events. Shows the last list at once, then refreshes on
 * mount, when the tab comes back into view, and every minute while visible.
 * `enabled` lets a closed dialog skip all of it.
 */
export function useEvents(enabled = true) {
  const [events, setEvents] = useState<BAEvent[] | null>(() => cache?.events ?? null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const refresh = () =>
      loadEvents().then(
        (e) => {
          if (!live) return;
          setEvents(e);
          setError(false);
        },
        () => live && setError(true)
      );
    void refresh();
    const timer = setInterval(() => !document.hidden && void refresh(), REFRESH_MS);
    const onVisible = () => !document.hidden && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, attempt]);

  const reload = useCallback(() => {
    cache = null;
    setError(false);
    setAttempt((n) => n + 1);
  }, []);

  return { events, error, reload };
}
