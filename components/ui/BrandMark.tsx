import Image from "next/image";
import { cn } from "@/lib/utils";
import seal from "@/public/brand/sbpa-seal.png";

/**
 * The School of Business and Public Administration seal. It is always shown
 * next to the product name or a heading, so it is decorative (empty alt).
 * The seal carries its own white field, so it reads on white, dark and yellow grounds.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src={seal}
      alt=""
      aria-hidden="true"
      // Rendered at most 56px; 64 gives Next a 1x/2x srcset (64w, 128w) that stays sharp on retina.
      width={64}
      height={64}
      loading="eager"
      draggable={false}
      className={cn("h-9 w-9 shrink-0 select-none rounded-full", className)}
    />
  );
}

/** Seal with the product name, for headers. `inverted` sets the name in white for dark grounds. */
export function BrandLockup({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-3.5 sm:gap-4", className)}>
      <BrandMark className="h-14 w-14 sm:h-16 sm:w-16" />
      <span className="leading-tight">
        <span className={cn("block font-display text-[1.375rem] font-semibold tracking-tight sm:text-[1.5rem]", inverted ? "text-white" : "text-ink")}>
          BA Attendance
        </span>
        <span className={cn("mt-0.5 block text-[0.9375rem] font-medium sm:text-base", inverted ? "text-white/80" : "text-ink-soft")}>
          College of Business Administration
        </span>
      </span>
    </span>
  );
}
