"use client";

import React, { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { input } from "@/components/ui/styles";

interface BaseProps {
  label: string;
  error?: string;
  hint?: string;
}

function Label({ htmlFor, label, required }: { htmlFor: string; label: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {label}
      {required && (
        <span className="text-brand" aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </label>
  );
}

function Help({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error)
    return (
      <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs font-medium text-rose">
        {error}
      </p>
    );
  if (hint)
    return (
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
        {hint}
      </p>
    );
  return null;
}

const describedBy = (id: string, hint?: string, error?: string) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

type FieldProps = BaseProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">;

/** Labelled input with inline error, hint, and a show/hide toggle for passwords. */
export function Field({ label, error, hint, type = "text", ...rest }: FieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <Label htmlFor={id} label={label} required={rest.required} />
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn(input, error && "border-rose focus:border-rose focus:ring-rose/15", isPassword && "pr-12")}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
          >
            {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      <Help id={id} hint={hint} error={error} />
    </div>
  );
}

type SelectFieldProps = BaseProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className">;

export function SelectField({ label, error, hint, children, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} label={label} required={rest.required} />
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(input, "appearance-none truncate bg-[length:1rem] pr-9", error && "border-rose")}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23586a86'%3E%3Cpath d='M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.75rem center",
        }}
        {...rest}
      >
        {children}
      </select>
      <Help id={id} hint={hint} error={error} />
    </div>
  );
}

type TextAreaFieldProps = BaseProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

export function TextAreaField({ label, error, hint, ...rest }: TextAreaFieldProps) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} label={label} required={rest.required} />
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(input, "h-auto min-h-24 py-2.5 leading-relaxed", error && "border-rose")}
        {...rest}
      />
      <Help id={id} hint={hint} error={error} />
    </div>
  );
}
