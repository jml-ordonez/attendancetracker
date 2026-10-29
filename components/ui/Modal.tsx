"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: labelled, Escape to close, focus trapped and restored,
 * background scroll locked. Bottom sheet on phones, centred card from `sm` up.
 */
export function Modal({ open, onClose, title, description, children, size = "md" }: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const preferredField = dialog?.querySelector<HTMLElement>('[data-autofocus="true"]');
    const firstField = dialog?.querySelector<HTMLElement>("input, select, textarea");
    (preferredField ?? firstField ?? dialog?.querySelector<HTMLElement>(FOCUSABLE))?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="animate-fade fixed inset-0 z-50 overflow-y-auto bg-ink/45"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-6">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          className={cn(
            "animate-sheet-in w-full overflow-hidden rounded-t-2xl bg-card shadow-[0_24px_60px_-12px_rgba(28,25,23,0.3)] sm:rounded-xl",
            SIZES[size]
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-7">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-ink">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm leading-relaxed text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="press -mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-brand-tint hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto px-5 py-6 sm:px-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
