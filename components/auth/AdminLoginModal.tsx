"use client";

import React, { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { btn } from "@/components/ui/styles";
import { DEMO_ADMIN } from "@/lib/auth/demo";

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where to go after signing in; only /admin paths are honoured. */
  next?: string | null;
}

export default function AdminLoginModal({ isOpen, onClose, next }: AdminLoginModalProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const destination = next && next.startsWith("/admin/") ? next : "/admin/dashboard";

  const reset = () => {
    setPassword("");
    setFieldErrors({});
    setFormError(null);
    setLoading(false);
    setCapsLock(false);
  };

  // The bug behind "refresh to sign in again": Next keeps this page alive (hidden)
  // after navigating to the console, so `loading` stayed true and the button stayed
  // disabled when the page came back. Reset whenever the page is hidden.
  useLayoutEffect(() => () => reset(), []);

  // Warm the console route while the person types.
  useEffect(() => {
    if (isOpen) router.prefetch(destination);
  }, [isOpen, destination, router]);

  const close = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setFormError(null);

    const errs: typeof fieldErrors = {};
    if (!username.trim()) errs.username = "Enter your username.";
    if (!password) errs.password = "Enter your password.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error ?? "Sign-in failed. Try again.");
        setPassword("");
        setLoading(false);
        return;
      }
      // Close before leaving: Next keeps this page alive, and Back should not reopen the dialog.
      setUsername("");
      reset();
      onClose();
      router.replace(destination);
    } catch {
      setFormError("No connection to the server. Check your network and try again.");
      setLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={close} size="sm" title="Admin sign in" description="For administrators, department chairs and event coordinators.">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && (
          <p role="alert" className="rounded-lg bg-rose-soft px-3 py-2.5 text-sm font-medium text-rose">
            {formError}
          </p>
        )}

        <Field
          label="Username"
          required
          type="text"
          autoComplete="username"
          value={username}
          error={fieldErrors.username}
          onChange={(e) => {
            setUsername(e.target.value);
            setFieldErrors((p) => ({ ...p, username: undefined }));
          }}
        />
        <div>
          <Field
            label="Password"
            required
            type="password"
            autoComplete="current-password"
            value={password}
            error={fieldErrors.password}
            hint={capsLock ? "Caps Lock is on." : undefined}
            onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((p) => ({ ...p, password: undefined }));
            }}
          />
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <button type="submit" disabled={loading} className={`${btn.primary} w-full`}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            <>
              Sign in to the console
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-brand-tint px-3.5 py-3 text-sm">
          <p className="min-w-0 text-ink-soft">
            Admin account: <span className="font-medium text-ink">{DEMO_ADMIN.username}</span> · <span className="font-medium text-ink">{DEMO_ADMIN.password}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setUsername(DEMO_ADMIN.username);
              setPassword(DEMO_ADMIN.password);
              setFieldErrors({});
            }}
            className="press shrink-0 rounded-md px-2 py-1 font-semibold text-brand hover:bg-brand-soft"
          >
            Fill in
          </button>
        </div>
      </form>
    </Modal>
  );
}

