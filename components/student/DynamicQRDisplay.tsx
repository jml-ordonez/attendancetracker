"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle, LogIn, LogOut, RefreshCw } from "lucide-react";
import type { TokenPurpose } from "@/types/qr";
import type { RegisteredStudentSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

interface DynamicQRDisplayProps {
  student: RegisteredStudentSession;
  eventId: string;
  sessionId: string;
}

/** Fetch the next code this long before the current one expires, so the swap is seamless. */
const REFRESH_EARLY_MS = 1500;

export function DynamicQRDisplay({ student, eventId, sessionId }: DynamicQRDisplayProps) {
  const [purpose, setPurpose] = useState<TokenPurpose>("time_in");
  const [qr, setQr] = useState<{ url: string; expiresAt: number; total: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const loading = useRef(false);
  /** Increments per request; a response from an older request (e.g. before switching pass type) is dropped. */
  const requestId = useRef(0);

  const fetchToken = useCallback(async (force = false) => {
    if (loading.current && !force) return;
    loading.current = true;
    const id = ++requestId.current;
    try {
      const res = await fetch("/api/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          sessionId,
          purpose,
          student: { name: student.fullName, idNumber: student.studentIdNumber, majorCode: student.majorCode, section: student.section },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (id !== requestId.current) return;
      if (!res.ok) throw new Error(data.error || "Couldn't create your pass. Try again.");
      // Expiry on this device's clock, so a phone set to the wrong time still counts down correctly.
      const expiresAt = data.expiresAt - (data.serverTime - Date.now());
      const url = await QRCode.toDataURL(data.token, {
        width: 640,
        margin: 1,
        color: { dark: "#0b1b36", light: "#ffffff" },
        errorCorrectionLevel: "L",
      });
      if (id !== requestId.current) return;
      setQr({ url, expiresAt, total: data.expirySeconds * 1000 });
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setQr(null);
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "No connection. Check your internet, then try again.");
    } finally {
      if (id === requestId.current) loading.current = false;
    }
  }, [eventId, sessionId, purpose, student]);

  // New event, session or pass type: drop the old code and fetch a fresh one straight away.
  const scope = `${eventId}|${sessionId}|${purpose}`;
  const [lastScope, setLastScope] = useState(scope);
  if (scope !== lastScope) {
    setLastScope(scope);
    setQr(null);
    setError(null);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- network request; state changes only after it responds
    void fetchToken(true);
  }, [fetchToken]);

  // One clock for the countdown. Paused while the tab is hidden; refreshes on return.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    let id: ReturnType<typeof setInterval> | undefined = setInterval(tick, 250);
    const onVis = () => {
      if (document.hidden) {
        clearInterval(id);
        id = undefined;
      } else if (!id) {
        tick();
        id = setInterval(tick, 250);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const remainingMs = qr ? qr.expiresAt - now : 0;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- network request; state changes only after it responds
    if (qr && remainingMs <= REFRESH_EARLY_MS && !document.hidden) void fetchToken();
  }, [qr, remainingMs, fetchToken]);

  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const fraction = qr ? Math.max(0, Math.min(1, remainingMs / qr.total)) : 0;
  const low = seconds <= 10;

  return (
    <div>
      <div role="radiogroup" aria-label="Pass type" className="grid grid-cols-2 gap-1 rounded-xl bg-paper p-1">
        {(
          [
            ["time_in", "Check in", LogIn],
            ["time_out", "Check out", LogOut],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={purpose === value}
            onClick={() => setPurpose(value)}
            className={cn(
              "press flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold",
              purpose === value ? "bg-brand text-white shadow-sm" : "text-ink-soft hover:text-ink"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="relative mx-auto mt-5 aspect-square w-full max-w-[19rem]">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-rose-soft p-6 text-center" role="alert">
            <AlertTriangle className="h-7 w-7 text-rose" aria-hidden="true" />
            <p className="text-sm font-medium text-rose">{error}</p>
            <button type="button" onClick={() => void fetchToken(true)} className="press h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-soft">
              Try again
            </button>
          </div>
        ) : qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={qr.url} src={qr.url} alt={`Attendance ${purpose === "time_in" ? "check-in" : "check-out"} pass for ${student.fullName}`} className="animate-fade h-full w-full rounded-lg [image-rendering:pixelated]" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-paper text-ink-soft" role="status">
            <RefreshCw className="h-6 w-6 animate-spin" aria-hidden="true" />
            <p className="text-sm">Encrypting your pass…</p>
          </div>
        )}
      </div>

      <div className="mt-5" aria-live="off">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-ink-soft">{purpose === "time_in" ? "Check-in pass" : "Check-out pass"} · new code in</span>
          <span className={cn("figures font-display text-2xl font-semibold leading-none", low ? "text-rose" : "text-ink")}>{qr ? `${seconds}s` : "—"}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper" aria-hidden="true">
          <div className={cn("h-full origin-left rounded-full transition-transform duration-300 ease-linear", low ? "bg-rose" : "bg-brand")} style={{ transform: `scaleX(${fraction})` }} />
        </div>
      </div>
    </div>
  );
}
