import React from "react";
import { cn } from "@/lib/utils";

const STYLES: Record<string, [string, string]> = {
  on_time: ["bg-pine-soft text-pine", "On time"],
  present: ["bg-pine-soft text-pine", "Present"],
  published: ["bg-pine-soft text-pine", "Published"],
  success: ["bg-pine-soft text-pine", "Success"],
  checked_out: ["bg-sky-soft text-sky", "Checked out"],
  late: ["bg-brass-soft text-brass", "Late"],
  left_early: ["bg-brass-soft text-brass", "Left early"],
  excused: ["bg-brand-soft text-brand-dark", "Excused"],
  draft: ["bg-paper text-ink-soft", "Draft"],
  cancelled: ["bg-rose-soft text-rose", "Cancelled"],
  absent: ["bg-rose-soft text-rose", "Absent"],
  failure: ["bg-rose-soft text-rose", "Failed"],
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const [styles, text] = STYLES[status] ?? ["bg-paper text-ink-soft", status.replace(/_/g, " ")];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium",
        styles,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label ?? text}
    </span>
  );
}
