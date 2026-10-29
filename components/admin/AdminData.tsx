"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { AdminIdentity } from "@/lib/auth/admin-session";
import type { AttendanceScan } from "@/types/attendance";
import type { BAEvent } from "@/types/events";
import { api, usePolling } from "@/lib/client/api";

interface AdminData {
  admin: AdminIdentity;
  scans: AttendanceScan[];
  events: BAEvent[];
  /** False until the first response arrives, so screens can show a loading state instead of zeros. */
  loaded: boolean;
  /** When the scans were last fetched. */
  updatedAt: Date | null;
  error: string | null;
  refreshScans: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  /** Shows a created or edited event at once, before the next refresh. */
  putEvent: (event: BAEvent) => void;
  /** Hides a deleted event at once, before the next refresh. */
  dropEvent: (id: string) => void;
}

const Ctx = createContext<AdminData | null>(null);

/**
 * Scans and events shared by every staff screen. Lives in the admin layout, so
 * switching screens shows data at once instead of refetching behind a spinner.
 */
export function AdminDataProvider({ admin, children }: { admin: AdminIdentity; children: React.ReactNode }) {
  const [scans, setScans] = useState<AttendanceScan[]>([]);
  const [events, setEvents] = useState<BAEvent[]>([]);
  const [loaded, setLoaded] = useState({ scans: false, events: false });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshScans = useCallback(async () => {
    try {
      const data = await api<{ records: AttendanceScan[] }>("/api/attendance/records");
      setScans(data.records);
      setUpdatedAt(new Date());
      setError(null);
      setLoaded((l) => (l.scans ? l : { ...l, scans: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the server.");
    }
  }, []);

  /**
   * Bumped by every events request and local change. A response from an older
   * request is dropped: a poll started before a delete must not bring the
   * deleted event back.
   */
  const eventsVersion = useRef(0);

  const refreshEvents = useCallback(async () => {
    const version = ++eventsVersion.current;
    try {
      const data = await api<{ events: BAEvent[] }>("/api/events");
      if (version !== eventsVersion.current) return;
      setEvents(data.events);
      setLoaded((l) => (l.events ? l : { ...l, events: true }));
    } catch {
      // The scans poll reports connection problems.
    }
  }, []);

  const putEvent = useCallback((event: BAEvent) => {
    eventsVersion.current++;
    setEvents((list) => {
      const next = list.some((e) => e.id === event.id) ? list.map((e) => (e.id === event.id ? event : e)) : [...list, event];
      return next.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    });
  }, []);

  const dropEvent = useCallback((id: string) => {
    eventsVersion.current++;
    setEvents((list) => list.filter((e) => e.id !== id));
  }, []);

  usePolling(refreshScans, 4000);
  usePolling(refreshEvents, 30000);

  const value = useMemo(
    () => ({
      admin,
      scans,
      events,
      loaded: loaded.scans && loaded.events,
      updatedAt,
      error,
      refreshScans,
      refreshEvents,
      putEvent,
      dropEvent,
    }),
    [admin, scans, events, loaded, updatedAt, error, refreshScans, refreshEvents, putEvent, dropEvent]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminData(): AdminData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminData must be used inside the admin layout.");
  return ctx;
}
