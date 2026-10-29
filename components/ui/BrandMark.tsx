import { cn } from "@/lib/utils";

/**
 * The product's crest: a shield carrying the BA monogram over a check,
 * the pass verified. Yellow on white and dark grounds; `inverted` draws it
 * charcoal for yellow grounds.
 */
export function BrandMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const field = inverted ? "#1c1917" : "#facc15";
  const ink = inverted ? "#facc15" : "#1c1917";
  const rim = inverted ? "#1c1917" : "#a16207";
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9 shrink-0 drop-shadow-[0_1px_1px_rgba(28,25,23,0.18)]", className)} aria-hidden="true">
      <path d="M32 3 57 10.5V30c0 15.2-10.4 26.6-25 31C17.4 56.6 7 45.2 7 30V10.5Z" fill={field} stroke={rim} strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d="M32 8.2 52.5 14.4V30c0 12.4-8.2 21.9-20.5 25.9C19.7 51.9 11.5 42.4 11.5 30V14.4Z"
        fill="none"
        stroke={ink}
        strokeOpacity="0.35"
        strokeWidth="1.2"
      />
      <text
        x="32"
        y="36.5"
        textAnchor="middle"
        fill={ink}
        style={{ font: "600 19px var(--font-plex-serif), Georgia, serif", letterSpacing: "-0.5px" }}
      >
        BA
      </text>
      <path d="M24.5 44.5l5 4.5 10-10" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Crest with the product name, for headers. `inverted` sets the name in white for dark grounds; the yellow crest reads on both. */
export function BrandLockup({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-3.5", className)}>
      <BrandMark className="h-12 w-12 sm:h-14 sm:w-14" />
      <span className="leading-tight">
        <span className={cn("block font-display text-[1.125rem] font-semibold tracking-tight", inverted ? "text-white" : "text-ink")}>
          BA Attendance
        </span>
        <span className={cn("block text-[13px]", inverted ? "text-white/70" : "text-ink-soft")}>College of Business Administration</span>
      </span>
    </span>
  );
}
