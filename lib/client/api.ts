"use client";

import { useEffect, useRef } from "react";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Record<string, string> = {}
  ) {
    super(message);
  }
}

/** JSON fetch for the staff screens. A 401 means the session ended: go back to sign-in. */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && window.location.pathname.startsWith("/admin")) {
    window.location.assign(new URL(`/?auth=admin&next=${encodeURIComponent(window.location.pathname)}`, window.location.origin).href);
  }
  if (!res.ok) throw new ApiError(data.error || "Something went wrong. Try again.", res.status, data.fieldErrors);
  return data as T;
}

/**
 * Runs `fn` now and every `ms` while the tab is visible. Stops when the tab is
 * hidden or the route is hidden by Next's Activity, and catches up on return.
 * The old dashboard polled every 3 seconds forever, even in a background tab.
 */
export function usePolling(fn: () => unknown, ms: number) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => void fnRef.current();
    const start = () => {
      if (timer) return;
      tick();
      timer = setInterval(tick, ms);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms]);
}
