"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import type { RegisteredStudentSession } from "@/lib/auth/session";
import { btn } from "@/components/ui/styles";

interface DynamicQRDisplayProps {
  student: RegisteredStudentSession;
  eventId: string;
  sessionId: string;
}

/**
 * The student's pass for one session. The same code is scanned to time in
 * and again to time out, so it is fetched once and can be saved as a PNG.
 */
export function DynamicQRDisplay({ student, eventId, sessionId }: DynamicQRDisplayProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Increments per request; a response from an older request (e.g. before switching event) is dropped. */
  const requestId = useRef(0);

  const fetchToken = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const res = await fetch("/api/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          sessionId,
          student: { name: student.fullName, idNumber: student.studentIdNumber, majorCode: student.majorCode, section: student.section },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (id !== requestId.current) return;
      if (!res.ok) throw new Error(data.error || "Couldn't create your pass. Try again.");
      // Rendered large with a full quiet zone so the on-screen code and the downloaded PNG both scan cleanly.
      const url = await QRCode.toDataURL(data.token, {
        width: 1024,
        margin: 4,
        color: { dark: "#1c1917", light: "#ffffff" },
        // L: a phone screen is a clean, flat surface, so the extra redundancy of M only makes the
        // modules smaller (77 → 69 per side for a pass), which is harder for cameras to read.
        errorCorrectionLevel: "L",
      });
      if (id !== requestId.current) return;
      setQr(url);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setQr(null);
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "No connection. Check your internet, then try again.");
    }
  }, [eventId, sessionId, student]);

  // New event or session: drop the old code and fetch the pass for this one.
  const scope = `${eventId}|${sessionId}`;
  const [lastScope, setLastScope] = useState(scope);
  if (scope !== lastScope) {
    setLastScope(scope);
    setQr(null);
    setError(null);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- network request; state changes only after it responds
    void fetchToken();
  }, [fetchToken]);

  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-[22rem]">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-rose-soft p-6 text-center" role="alert">
            <AlertTriangle className="h-7 w-7 text-rose" aria-hidden="true" />
            <p className="text-sm font-medium text-rose">{error}</p>
            <button type="button" onClick={() => void fetchToken()} className="press h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-soft">
              Try again
            </button>
          </div>
        ) : qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`Attendance pass for ${student.fullName}`} className="animate-fade h-full w-full rounded-lg border border-line [image-rendering:pixelated]" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-paper text-ink-soft" role="status">
            <RefreshCw className="h-6 w-6 animate-spin" aria-hidden="true" />
            <p className="text-sm">Encrypting your pass…</p>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-ink-soft">Show this pass when you arrive and again when you leave.</p>

      {qr && (
        <a href={qr} download="attendance-qr.png" className={`${btn.secondary} mt-4 w-full`}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Download QR
        </a>
      )}
    </div>
  );
}
