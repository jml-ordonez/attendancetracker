"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { Field } from "@/components/ui/Field";
import { btn } from "@/components/ui/styles";
import { EMAIL_PATTERN } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Enter a valid email address, such as name@university.edu.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      setState("sent");
    } catch {
      setError("No connection to the server. Try again.");
      setState("idle");
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-card p-5">
      <div className="animate-rise w-full max-w-md rounded-2xl border border-line bg-card p-7 sm:p-9">
        <BrandMark className="h-11 w-11" />
        {state === "sent" ? (
          <div className="mt-6">
            <MailCheck className="h-8 w-8 text-pine" aria-hidden="true" />
            <h1 className="mt-3 font-display text-[1.75rem] font-semibold leading-tight">Check your inbox</h1>
            <p className="mt-2 leading-relaxed text-ink-soft">
              If <span className="font-medium text-ink">{email.trim()}</span> belongs to a staff account, a reset link is on its way. It can take a few minutes; check your spam folder too.
            </p>
            <Link href="/?auth=admin" className={`${btn.primary} mt-7 w-full`}>
              Back to staff sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-6">
            <h1 className="font-display text-[1.75rem] font-semibold leading-tight">Reset your password</h1>
            <p className="mt-2 leading-relaxed text-ink-soft">
              Enter the email you use to sign in to the staff console. Student passes don’t use passwords.
            </p>
            <div className="mt-6">
              <Field
                label="Staff email"
                required
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="name@university.edu"
                value={email}
                error={error ?? undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <button type="submit" disabled={state === "sending"} className={`${btn.primary} mt-6 w-full`}>
              {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Send reset link
            </button>
            <Link href="/?auth=admin" className={`${btn.ghost} mt-2 w-full`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
