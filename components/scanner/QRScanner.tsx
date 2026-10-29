"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { AlertCircle, Camera, CameraOff, CheckCircle2, Clock3, Keyboard, Loader2, RefreshCcw, Volume2, VolumeX } from "lucide-react";
import type { ScanVerificationResult } from "@/types/qr";
import { cn } from "@/lib/utils";
import { formatDuration, formatTimeSeconds } from "@/lib/format";

interface QRScannerProps {
  eventId: string;
  sessionId: string;
  disabled?: boolean;
  onScanned?: (result: ScanVerificationResult) => void;
  onOpenManualEntry?: () => void;
}

const READER_ID = "camera-reader";

/**
 * A pass held in front of the camera is read every frame. It is sent once, then
 * ignored until it has been out of view this long, so the same pass can be
 * shown again later to time out.
 */
const OUT_OF_VIEW_MS = 4000;

/** Passes are the compact format (V2:…) or the older base64url envelope (eyJ…). Anything else is not ours. */
const PASS_PATTERN = /^(?:V2:[A-Z0-9]+:[A-Z2-7]+|eyJ[A-Za-z0-9_-]+)$/;

const now = () => new Date().toISOString();

/** html5-qrcode reports camera failures as strings ("…NotAllowedError: Permission denied"), not Error objects. */
function cameraErrorName(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name && name !== "Error") return name;
  const text = String((err as { message?: string })?.message ?? err);
  return text.match(/(NotAllowedError|PermissionDeniedError|NotFoundError|DevicesNotFoundError|OverconstrainedError|NotReadableError|TrackStartError|InsecureContext)/)?.[1] ?? "Unknown";
}

export function QRScanner({ eventId, sessionId, disabled, onScanned, onOpenManualEntry }: QRScannerProps) {
  const [camera, setCamera] = useState<"starting" | "on" | "off" | "error">("starting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanVerificationResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [sound, setSound] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const transitioning = useRef(false);
  const busy = useRef(false);
  /** Pass → when the camera last saw it. */
  const recent = useRef(new Map<string, number>());
  const mounted = useRef(true);
  const audioRef = useRef<AudioContext | null>(null);

  // Latest props for the camera callback, which is registered once.
  const ctx = useRef({ eventId, sessionId, disabled, sound, onScanned });
  useEffect(() => {
    ctx.current = { eventId, sessionId, disabled, sound, onScanned };
  });

  // A new session starts with a clean slate.
  const scope = `${eventId}|${sessionId}`;
  const [lastScope, setLastScope] = useState(scope);
  if (scope !== lastScope) {
    setLastScope(scope);
    setResult(null);
  }
  useEffect(() => {
    recent.current.clear();
  }, [scope]);

  /** One shared AudioContext. The old code made a new one per scan; browsers cap them at about six. */
  const chime = (ok: boolean) => {
    if (!ctx.current.sound) return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = (audioRef.current ??= new Ctor());
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain).connect(ac.destination);
      const t = ac.currentTime;
      if (ok) {
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.setValueAtTime(990, t + 0.09);
      } else {
        osc.type = "square";
        osc.frequency.setValueAtTime(196, t);
      }
      gain.gain.setValueAtTime(ok ? 0.18 : 0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch {}
    if ("vibrate" in navigator) navigator.vibrate(ok ? [40, 50, 40] : [160, 60, 160]);
  };

  const verify = async (raw: string) => {
    const c = ctx.current;
    const token = raw.trim();
    const seen = Date.now();
    const last = recent.current.get(token);
    if (busy.current || c.disabled) {
      // Still in view while its own request is in flight: keep it marked as seen.
      if (last !== undefined) recent.current.set(token, seen);
      return;
    }
    recent.current.set(token, seen);
    if (last !== undefined && seen - last < OUT_OF_VIEW_MS) return;
    if (recent.current.size > 200) {
      for (const [t, at] of recent.current) if (seen - at > OUT_OF_VIEW_MS) recent.current.delete(t);
    }

    let r: ScanVerificationResult;
    if (!PASS_PATTERN.test(token)) {
      r = { success: false, status: "TOKEN_INVALID", message: "QR not recognized. This code isn’t a BA Attendance pass.", timestamp: now() };
      setResult(r);
      chime(false);
      c.onScanned?.(r);
      return;
    }

    busy.current = true;
    setProcessing(true);
    try {
      const res = await fetch("/api/qr/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, eventId: c.eventId, sessionId: c.sessionId }),
      });
      if (res.status === 401) {
        window.location.assign(new URL(`/?auth=admin&next=${encodeURIComponent(window.location.pathname)}`, window.location.origin).href);
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.ok && data) r = data;
      else if (res.status >= 500 || !data) {
        r = { success: false, status: "SERVER_ERROR", message: `Server error (${res.status}). Nothing was recorded; scan the pass again.`, timestamp: now() };
        recent.current.delete(token); // allow a retry
      } else r = { success: false, status: "TOKEN_INVALID", message: data.error ?? "Invalid QR. This code couldn’t be read as a pass.", timestamp: now() };
    } catch {
      r = { success: false, status: "SERVER_ERROR", message: "Network error. No connection to the server; check the network and scan again.", timestamp: now() };
      recent.current.delete(token); // allow a retry
    } finally {
      busy.current = false;
      setProcessing(false);
    }
    setResult(r);
    chime(r.success);
    c.onScanned?.(r);
  };
  const verifyRef = useRef(verify);
  useEffect(() => {
    verifyRef.current = verify;
  });

  const start = useCallback(async () => {
    if (transitioning.current || scannerRef.current?.isScanning) return;
    transitioning.current = true;
    try {
      // Loaded on demand: the library only ships to the scanner screen, and only once the camera starts.
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (!window.isSecureContext) {
        throw Object.assign(new Error("insecure"), { name: "InsecureContext" });
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("no camera api"), { name: "NotFoundError" });
      }
      scannerRef.current ??= new Html5Qrcode(READER_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        // The browser's own detector (Chrome, Edge, Android) reads dense codes far better than the JS fallback.
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
      });
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 12,
          qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.8); return { width: s, height: s }; },
          // A sharper rear-camera stream; "ideal" falls back quietly on cameras that can't.
          videoConstraints: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        },
        (text) => void verifyRef.current(text),
        () => {}
      );
      // Left the screen while the camera was starting: release it.
      if (!mounted.current) {
        await scannerRef.current.stop().catch(() => {});
        return;
      }
      setCamera("on");
    } catch (err) {
      const name = cameraErrorName(err);
      setCamera("error");
      setCameraError(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Camera permission denied. Allow camera access in the browser’s site settings, then try again."
          : name === "InsecureContext"
            ? "The camera only works on a secure address (https or localhost). Open the console over https on this device."
            : name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError"
              ? "Camera unavailable: no camera was found on this device. Use manual entry instead."
              : name === "NotReadableError" || name === "TrackStartError"
                ? "Camera unavailable: another app or tab is using it. Close it, then try again."
                : "The camera couldn’t start. Close other apps that may be using it, then try again."
      );
    } finally {
      transitioning.current = false;
    }
  }, []);

  const retry = () => {
    setCamera("starting");
    setCameraError(null);
    void start();
  };

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    if (!s?.isScanning || transitioning.current) return;
    transitioning.current = true;
    try {
      await s.stop();
    } catch {}
    transitioning.current = false;
    setCamera("off");
  }, []);

  // Start on show, stop on hide (including when Next hides this route with Activity).
  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the camera; state changes only after it responds
    void start();
    return () => {
      mounted.current = false;
      const s = scannerRef.current;
      if (s?.isScanning) s.stop().catch(() => {});
      void audioRef.current?.close().catch(() => {});
      audioRef.current = null;
    };
  }, [start]);

  const tone = !result ? null : result.success ? (result.details?.isLate || result.details?.isEarlyDeparture ? "warn" : "ok") : "fail";

  return (
    <div className="grid overflow-hidden rounded-xl border border-line bg-card lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Viewfinder */}
      <div className="relative flex min-h-[340px] flex-col items-center justify-center bg-[#1c1917] p-4 sm:min-h-[420px]">
        <div className="relative w-full max-w-md overflow-hidden rounded-lg">
          <div id={READER_ID} className="aspect-square w-full bg-black [&_#qr-shaded-region]:hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {camera === "on" && (
            <div className="pointer-events-none absolute inset-[14%]" aria-hidden="true">
              <div className="absolute inset-0 rounded-md border-2 border-white/80" />
              <div className="scan-sweep absolute inset-0">
                <div className="mx-2 h-0.5 bg-brand shadow-[0_0_10px_1px_rgba(250,204,21,0.6)]" />
              </div>
            </div>
          )}
        </div>

        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2 text-sm text-white">
          <span className="flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5">
            {camera === "on" ? <span className="live-dot text-emerald-400" aria-hidden="true" /> : <CameraOff className="h-3.5 w-3.5" aria-hidden="true" />}
            {camera === "on" ? "Scanning passes · in or out" : camera === "starting" ? "Starting camera…" : "Camera off"}
          </span>
          <span className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setSound((v) => !v)}
              aria-label={sound ? "Mute scan sound" : "Turn on scan sound"}
              aria-pressed={sound}
              className="press flex h-10 w-10 items-center justify-center rounded-full bg-black/45 hover:bg-black/70"
            >
              {sound ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={camera === "on" ? stop : retry}
              aria-label={camera === "on" ? "Turn camera off" : "Turn camera on"}
              className="press flex h-10 w-10 items-center justify-center rounded-full bg-black/45 hover:bg-black/70"
            >
              {camera === "on" ? <CameraOff className="h-4 w-4" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
            </button>
          </span>
        </div>

        {camera === "error" && (
          <div className="absolute inset-4 flex flex-col items-center justify-center rounded-lg bg-[#1c1917]/95 p-6 text-center text-white" role="alert">
            <AlertCircle className="mb-3 h-9 w-9 text-rose-300" aria-hidden="true" />
            <p className="font-semibold">Camera unavailable</p>
            <p className="mt-1 max-w-xs text-sm text-white/75">{cameraError}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={retry} className="press inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-ink hover:bg-brand-soft">
                <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Try again
              </button>
              {onOpenManualEntry && (
                <button type="button" onClick={onOpenManualEntry} className="press inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 px-4 text-sm font-semibold hover:bg-white/10">
                  <Keyboard className="h-4 w-4" aria-hidden="true" /> Manual entry
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      <div className="flex flex-col border-t border-line p-5 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Last scan</h2>
          {processing && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-brand-ink" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Verifying…
            </span>
          )}
        </div>

        <div className="mt-4 flex-1" aria-live="assertive" aria-atomic="true">
          {result ? (
            <div
              key={result.timestamp}
              className={cn(
                "animate-pop rounded-xl p-5",
                tone === "ok" && "bg-pine-soft",
                tone === "warn" && "bg-brass-soft",
                tone === "fail" && "bg-rose-soft"
              )}
            >
              <div className={cn("flex items-center gap-2 font-semibold", tone === "ok" ? "text-pine" : tone === "warn" ? "text-brass" : "text-rose")}>
                {tone === "fail" ? <AlertCircle className="h-5 w-5" aria-hidden="true" /> : tone === "warn" ? <Clock3 className="h-5 w-5" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                {tone === "fail" ? "Not recorded" : result.details?.action === "time_out" ? (tone === "warn" ? "Left early" : "Timed out") : tone === "warn" ? "Late" : "Timed in"}
              </div>
              {result.details?.studentName && (
                <p className="mt-3 font-display text-[1.375rem] font-semibold leading-tight text-ink">{result.details.studentName}</p>
              )}
              {result.details?.studentIdNumber && <p className="figures text-sm text-ink-soft">{result.details.studentIdNumber}</p>}
              <p className="mt-3 text-sm leading-relaxed text-ink">{result.message}</p>
              <p className="figures mt-3 text-xs text-ink-soft">
                {formatTimeSeconds(result.timestamp)}
                {result.details?.durationMinutes ? ` · stayed ${formatDuration(result.details.durationMinutes)}` : ""}
              </p>
            </div>
          ) : (
            <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-line-strong p-6 text-center">
              <Camera className="mb-2 h-6 w-6 text-muted" aria-hidden="true" />
              <p className="text-sm text-ink-soft">Hold the student’s pass inside the frame. The first scan checks them in; the same pass scanned later checks them out.</p>
            </div>
          )}
        </div>

        {onOpenManualEntry && (
          <button type="button" onClick={onOpenManualEntry} className="press mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line-strong text-sm font-semibold text-ink hover:border-brand hover:text-brand-ink">
            <Keyboard className="h-4 w-4" aria-hidden="true" />
            Manual entry
          </button>
        )}
      </div>
    </div>
  );
}
