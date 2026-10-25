"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";

const N = 25;
const CYCLE_MS = 3600;

/** Deterministic pseudo-random modules, so server and client render the same first frame. */
function modules(seed: number): boolean[] {
  let s = seed * 9301 + 49297;
  const out: boolean[] = [];
  for (let i = 0; i < N * N; i++) {
    s = (s * 9301 + 49297) % 233280;
    out.push(s / 233280 > 0.52);
  }
  return out;
}

const inFinder = (x: number, y: number) =>
  (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);

function Finder({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="7" height="7" rx="1.2" fill="#0b1b36" />
      <rect x={x + 1} y={y + 1} width="5" height="5" rx="0.8" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" rx="0.5" fill="#1d4ed8" />
    </g>
  );
}

/**
 * An illustration of the student pass, not a working code: the pattern reshuffles
 * as a real pass rotates, a scanner line sweeps it, and the check-in confirms.
 */
export function PassPreview() {
  const [seed, setSeed] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setSeed((s) => s + 1), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const grid = useMemo(() => modules(seed), [seed]);

  return (
    <div className="animate-float relative w-[15.5rem] select-none 2xl:w-[17.5rem]" aria-hidden="true">
      <div className="overflow-hidden rounded-[1.375rem] bg-white shadow-[0_30px_60px_-20px_rgba(2,8,30,0.65)] ring-1 ring-white/40">
        <div className="flex items-center justify-between bg-brand-deep px-5 py-4 text-white">
          <div>
            <p className="text-[11px] font-medium text-white/65">Sample pass</p>
            <p className="font-display text-lg font-semibold leading-tight">Maria Santos</p>
            <p className="figures text-xs text-white/75">2021003213 · MM-1A</p>
          </div>
          <BrandMark inverted className="h-9 w-9" />
        </div>

        <div className="relative px-5 pb-5 pt-4">
          <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-lg">
            <svg key={seed} viewBox={`-1 -1 ${N + 2} ${N + 2}`} className="animate-fade h-full w-full" shapeRendering="crispEdges">
              <rect x="-1" y="-1" width={N + 2} height={N + 2} fill="#fff" />
              {grid.map((on, i) => {
                const x = i % N;
                const y = Math.floor(i / N);
                return on && !inFinder(x, y) ? <rect key={i} x={x} y={y} width="1" height="1" fill="#0b1b36" /> : null;
              })}
              <Finder x={0} y={0} />
              <Finder x={N - 7} y={0} />
              <Finder x={0} y={N - 7} />
            </svg>
            <div className="scan-sweep pointer-events-none absolute inset-0">
              <div className="h-[3px] bg-brand/70 shadow-[0_0_12px_2px_rgba(29,78,216,0.45)]" />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[13px]">
            <span className="text-ink-soft">New code in</span>
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-90">
                <circle cx="10" cy="10" r="8" fill="none" stroke="#e6eefc" strokeWidth="3" />
                <circle key={seed} cx="10" cy="10" r="8" fill="none" stroke="#1d4ed8" strokeWidth="3" strokeDasharray="50.3" className="animate-countdown" style={{ animationDuration: `${CYCLE_MS}ms` }} />
              </svg>
              <span className="figures font-semibold text-ink">45s</span>
            </span>
          </div>
        </div>
      </div>

      <div key={seed} className="animate-toast absolute -bottom-5 -left-10 flex items-center gap-2.5 rounded-xl bg-white px-4 py-3 shadow-[0_18px_40px_-14px_rgba(2,8,30,0.6)]">
        <CheckCircle2 className="h-5 w-5 text-pine" />
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-ink">Checked in</span>
          <span className="figures block text-xs text-ink-soft">On time · 8:04 AM</span>
        </span>
      </div>
    </div>
  );
}
