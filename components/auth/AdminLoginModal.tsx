"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { btn } from "@/components/ui/styles";
import type { AdminIdentity } from "@/lib/auth/admin-session";

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where to go after signing in; only /admin paths are honoured. */
  next?: string | null;
  onSuccess?: (admin: AdminIdentity) => void;
}

const LAST_ADMIN_USER_KEY = "ba_last_admin_username";
const LOGIN_TIMEOUT_MS = 10000;

function readSavedUsername(): string {
  if (typeof window === "undefined") return "";
  try {
    // Older sign-ins may have saved a full email; the field takes the username only.
    return (localStorage.getItem(LAST_ADMIN_USER_KEY) ?? "").split("@")[0];
  } catch {
    return "";
  }
}

export default function AdminLoginModal({ isOpen, onClose, next, onSuccess }: AdminLoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const destination = next && next.startsWith("/admin/") ? next : "/admin/dashboard";
  const busy = loading || redirecting;

  const reset = () => {
    setPassword("");
    setFieldErrors({});
    setFormError(null);
    setLoading(false);
    setRedirecting(false);
    setCapsLock(false);
  };

  // Sync state whenever the dialog opens so it never re-opens stuck on "Signing in…"
  // and pre-fills the last signed-in staff username to avoid redundant entry.
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      reset();
      if (!username) {
        const saved = readSavedUsername();
        if (saved) setUsername(saved);
      }
    }
  }

  // Reset if Next hides this route with <Activity> or browser restores from bfcache.
  useLayoutEffect(() => () => reset(), []);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reset();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const close = () => {
    if (redirecting) return;
    reset();
    onClose();
  };

  const focusField = (name: "username" | "password") => {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.focus();
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFormError(null);

    const trimmedUsername = username.trim();
    const errs: typeof fieldErrors = {};
    if (!trimmedUsername) errs.username = "Enter your username.";
    else if (trimmedUsername.includes("@")) errs.username = `Enter your username only, without the “@” part (e.g. ${trimmedUsername.split("@")[0] || "admin"}).`;
    else if (/\s/.test(trimmedUsername)) errs.username = "Usernames don’t contain spaces.";
    if (!password) errs.password = "Enter your password.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      focusField(errs.username ? "username" : "password");
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedUsername, password }),
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Sign-in failed. Try again.");
        setPassword("");
        setLoading(false);
        focusField("password");
        return;
      }

      try {
        localStorage.setItem(LAST_ADMIN_USER_KEY, trimmedUsername);
      } catch {}

      if (data.admin) onSuccess?.(data.admin);
      setRedirecting(true);

      // Navigate with a full document replacement so the browser sends the newly
      // issued HttpOnly session cookie immediately and bypasses any unauthenticated
      // redirect cached in the client router.
      window.location.replace(destination);
    } catch (err) {
      clearTimeout(timer);
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setFormError(
        timedOut
          ? "Sign-in took too long to respond. Check your network and try again."
          : "No connection to the server. Check your network and try again."
      );
      setLoading(false);
      setRedirecting(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={close} size="sm" title="Admin sign in" description="For administrators, department chairs and event coordinators.">
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-rose-soft px-3.5 py-2.5 text-sm font-medium text-rose">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <Field
          label="Username"
          name="username"
          required
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy}
          value={username}
          error={fieldErrors.username}
          onChange={(e) => {
            setUsername(e.target.value);
            setFieldErrors((p) => (p.username ? { ...p, username: undefined } : p));
            if (formError) setFormError(null);
          }}
        />
        <div>
          <Field
            label="Password"
            name="password"
            required
            type="password"
            autoComplete="current-password"
            data-autofocus={username.trim() ? "true" : undefined}
            disabled={busy}
            value={password}
            error={fieldErrors.password}
            hint={capsLock ? "Caps Lock is on." : undefined}
            onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
            onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((p) => (p.password ? { ...p, password: undefined } : p));
              if (formError) setFormError(null);
            }}
          />
          <p className="mt-2 text-xs text-muted">Session stays active for 8 hours</p>
        </div>

        <button type="submit" disabled={busy} className={`${btn.primary} h-12 w-full text-[15px]`}>
          {redirecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Opening console…
            </>
          ) : loading ? (
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
      </form>
    </Modal>
  );
}
