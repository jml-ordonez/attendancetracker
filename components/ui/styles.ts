/** Button and surface classes, so every screen uses the same controls. */

const base =
  "press inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55";

export const btn = {
  primary: `${base} h-11 bg-brand px-5 text-white hover:bg-brand-dark`,
  secondary: `${base} h-11 border border-line-strong bg-card px-4 text-ink hover:border-brand hover:text-brand`,
  ghost: `${base} h-10 px-3 text-ink-soft hover:bg-brand-tint hover:text-brand`,
  danger: `${base} h-11 border border-rose/30 bg-card px-4 text-rose hover:border-rose hover:bg-rose-soft`,
  dangerSolid: `${base} h-11 bg-rose px-5 text-white hover:bg-rose/90`,
  small: `${base} h-9 border border-line-strong bg-card px-3 text-ink hover:border-brand hover:text-brand`,
} as const;

export const card = "rounded-xl border border-line bg-card";

export const input =
  "block h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-base text-ink placeholder:text-muted/70 transition-colors sm:text-sm focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/15";
