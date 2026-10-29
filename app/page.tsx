"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Lock,
  LogOut,
  PencilLine,
  QrCode,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { StudentRegisterModal } from "@/components/auth/StudentRegisterModal";
import AdminLoginModal from "@/components/auth/AdminLoginModal";
import { PassPreview } from "@/components/landing/PassPreview";
import { BrandLockup } from "@/components/ui/BrandMark";
import { btn } from "@/components/ui/styles";
import { clearStudentRegistration, useRegisteredStudent } from "@/lib/auth/session";
import type { AdminIdentity } from "@/lib/auth/admin-session";
import { MAJOR_SHORT } from "@/lib/validation";
import campus from "@/public/images/campus.jpg";

type ModalKind = "register" | "admin" | null;

const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

/**
 * Watches `?auth=admin&next=...` or `?auth=student` across both initial loads
 * and client-side navigations (which preserve LandingPage via Next 16 <Activity>).
 */
function AuthQuerySync({
  onAuthParam,
}: {
  onAuthParam: (kind: ModalKind, nextPath: string | null) => void;
}) {
  const searchParams = useSearchParams();
  const auth = searchParams.get("auth");
  const nextParam = searchParams.get("next");

  useEffect(() => {
    if (!auth) return;
    const validNext = nextParam && nextParam.startsWith("/admin/") ? nextParam : null;
    const kind: ModalKind = auth === "admin" ? "admin" : auth === "student" ? "register" : null;
    window.history.replaceState(null, "", window.location.pathname);
    onAuthParam(kind, validNext);
  }, [auth, nextParam, onAuthParam]);

  return null;
}

export default function LandingPage() {
  const router = useRouter();
  const [modal, setModal] = useState<ModalKind>(null);
  const [next, setNext] = useState<string | null>(null);
  const [adminSession, setAdminSession] = useState<AdminIdentity | null>(null);
  const [signingOutAdmin, setSigningOutAdmin] = useState(false);
  const student = useRegisteredStudent();
  const ready = student !== undefined;

  // Check if a valid HttpOnly staff session cookie already exists so returning
  // staff can jump straight into the console without re-authenticating.
  const checkAdminSession = useCallback(async (): Promise<AdminIdentity | null> => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as { admin?: AdminIdentity | null };
      const active = data.admin ?? null;
      setAdminSession(active);
      return active;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- network request; state changes only after it responds
    void checkAdminSession();
    const onVisibility = () => {
      if (!document.hidden) void checkAdminSession();
    };
    window.addEventListener("visibilitychange", onVisibility);
    return () => window.removeEventListener("visibilitychange", onVisibility);
  }, [checkAdminSession]);

  // Warm the student pass route when a student is already registered on this device.
  useEffect(() => {
    if (student) router.prefetch("/student/qr");
  }, [student, router]);

  const handleAuthParam = useCallback(
    async (kind: ModalKind, nextPath: string | null) => {
      setNext(nextPath);
      if (kind === "admin") {
        const active = await checkAdminSession();
        if (active) {
          window.location.replace(nextPath ?? "/admin/dashboard");
          return;
        }
      }
      setModal(kind);
    },
    [checkAdminSession]
  );

  const handleAdminSignOut = async () => {
    setSigningOutAdmin(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      setAdminSession(null);
    } finally {
      setSigningOutAdmin(false);
    }
  };

  const consoleDestination = next && next.startsWith("/admin/") ? next : "/admin/dashboard";

  return (
    <div className="grid min-h-dvh bg-card lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Suspense fallback={null}>
        <AuthQuerySync onAuthParam={handleAuthParam} />
      </Suspense>

      {/* ---------- The campus: photograph, title and the live pass ---------- */}
      <section className="relative order-1 isolate flex flex-col overflow-hidden border-b border-line bg-brand-tint text-ink lg:min-h-dvh lg:border-b-0 lg:border-r">
        {/* Decorative: the page's text carries the meaning. Grayscale first so the
            building's own teal never shows through the yellow shade. */}
        <Image
          src={campus}
          alt=""
          fill
          priority
          placeholder="blur"
          quality={85}
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="animate-ken-burns -z-30 object-cover object-[center_60%] lg:object-bottom contrast-[1.08] grayscale"
        />
        {/* Yellow shade: multiply tints the grayscale photo a warm amber; the light wash softens it
            without washing it out, and stays strongest at the top where the logo sits. */}
        <div className="absolute inset-0 -z-20 bg-[#fbbf24] mix-blend-multiply" aria-hidden="true" />
        <div
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.3)_20%,rgba(255,255,255,0.08)_55%,rgba(254,243,199,0.28)_100%)]"
          aria-hidden="true"
        />

        <div className="flex flex-1 flex-col px-6 py-10 sm:px-10 lg:px-14 lg:py-12 xl:px-16">
          <div>
            <BrandLockup />
          </div>

          <div className="flex flex-1 flex-col justify-center gap-14 py-4 lg:py-14 xl:flex-row xl:items-center xl:justify-between xl:gap-10">
            <div className="max-w-[30rem] rounded-2xl bg-white/85 p-6 shadow-[0_20px_50px_-28px_rgba(133,77,14,0.45)] ring-1 ring-white/70 backdrop-blur-md sm:p-8 xl:min-w-[25rem] xl:flex-1">
              <h1 className="font-display text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.025em] sm:text-[3.5rem] xl:text-[3.125rem] 2xl:text-[3.75rem]">
                <span className="animate-rise block">Every seat,</span>
                <span className="animate-rise block" style={rise(1)}>
                  <span className="bg-[linear-gradient(transparent_62%,var(--color-brand)_62%,var(--color-brand)_92%,transparent_92%)] px-1 [box-decoration-break:clone] sm:whitespace-nowrap">
                    accounted for.
                  </span>
                </span>
              </h1>
              <p className="animate-rise mt-6 max-w-sm text-lg leading-relaxed text-ink-soft" style={rise(2)}>
                Encrypted QR attendance for Business Administration seminars and assemblies.
              </p>
            </div>

            <div className="animate-rise flex justify-center pb-6 xl:pb-0 xl:pr-4" style={rise(3)}>
              <PassPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Access ---------- */}
      <main className="order-2 flex flex-col px-5 py-8 sm:px-10 lg:px-14 lg:py-12 xl:px-20">
        <div className="mx-auto flex w-full max-w-[27rem] flex-1 flex-col justify-center py-10">
          <h2 className="animate-rise font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight">Welcome</h2>
          <p className="animate-rise mt-2 text-[17px] text-ink-soft" style={rise(1)}>
            Students get a pass. Staff run the door.
          </p>

          {/* Student */}
          <article
            className="lift animate-rise mt-8 overflow-hidden rounded-2xl border border-brand/20 bg-card"
            style={rise(2)}
            aria-labelledby="student-h"
          >
            <div className="relative bg-brand px-6 pb-5 pt-6 text-ink">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="student-h" className="font-display text-[1.375rem] font-semibold leading-tight">
                    Students
                  </h3>
                  <p className="mt-1 text-[15px] text-ink/75">
                    {student ? "Your pass is ready on this device." : "No account or password needed."}
                  </p>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/45" aria-hidden="true">
                  <QrCode className="h-6 w-6" />
                </span>
              </div>
            </div>

            <div className="p-6">
              {!ready ? (
                <div className="h-24 animate-pulse rounded-lg bg-paper" />
              ) : student ? (
                <>
                  <div className="flex items-center gap-4 rounded-xl bg-brand-tint p-4">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-base font-semibold text-ink"
                      aria-hidden="true"
                    >
                      {student.firstName.charAt(0)}
                      {student.lastName.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        {student.fullName}
                        <BadgeCheck className="h-4 w-4 shrink-0 text-brand-ink" aria-label="Registered" />
                      </p>
                      <p className="figures text-sm text-ink-soft">
                        {student.studentIdNumber} · {student.section}
                      </p>
                      <p className="truncate text-sm text-muted">{MAJOR_SHORT[student.majorCode]} Management</p>
                    </div>
                  </div>
                  <Link href="/student/qr" className={`${btn.primary} group mt-5 h-12 w-full text-[15px]`}>
                    Show my pass
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => setModal("register")}
                      className="press inline-flex h-10 items-center gap-1.5 rounded-md px-2 font-semibold text-brand-ink hover:bg-brand-tint"
                    >
                      <PencilLine className="h-4 w-4" aria-hidden="true" />
                      Edit details
                    </button>
                    <button
                      type="button"
                      onClick={clearStudentRegistration}
                      className="press h-10 rounded-md px-2 text-muted hover:text-rose"
                    >
                      Not you? Remove
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="leading-relaxed text-ink-soft">
                    Register your student ID once, then show your pass at the door.
                  </p>
                  <button
                    type="button"
                    onClick={() => setModal("register")}
                    className={`${btn.primary} group mt-5 h-12 w-full text-[15px]`}
                  >
                    Get my attendance pass
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </article>

          {/* Staff */}
          {adminSession ? (
            <div
              className="lift animate-rise mt-4 rounded-2xl border border-brand/25 bg-card p-5"
              style={rise(3)}
              aria-label="Faculty and staff session"
            >
              <div className="flex items-center gap-3.5">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"
                  aria-hidden="true"
                >
                  <UserCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{adminSession.name}</p>
                  <p className="truncate text-xs text-muted">
                    {adminSession.title} · Active staff session
                  </p>
                </div>
                <button
                  type="button"
                  disabled={signingOutAdmin}
                  onClick={handleAdminSignOut}
                  className="press inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted hover:bg-rose-soft hover:text-rose"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign out
                </button>
              </div>
              <div className="mt-4 flex items-center gap-2.5">
                <a
                  href={consoleDestination}
                  className={`${btn.secondary} group h-10 flex-1 border-brand/30 bg-brand-tint text-brand-ink hover:bg-brand hover:text-ink`}
                >
                  Open staff console
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => setModal("admin")}
                  className="press h-10 rounded-lg border border-line-strong px-3 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand-ink"
                >
                  Switch account
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setModal("admin")}
              className="lift animate-rise group mt-4 flex w-full items-center gap-4 rounded-2xl border border-line bg-card p-5 text-left hover:border-brand/40"
              style={rise(3)}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paper text-ink-soft transition-colors group-hover:bg-brand-soft group-hover:text-brand-ink"
                aria-hidden="true"
              >
                <ShieldCheck className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold text-ink">Faculty and staff</span>
                <span className="block text-sm text-ink-soft">Scanner, events, records and reports</span>
              </span>
              <span className="flex items-center gap-1 text-sm font-semibold text-brand-ink">
                Sign in
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </button>
          )}

          <p className="animate-rise mt-8 flex items-center justify-center gap-2 text-sm text-muted" style={rise(4)}>
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Encrypted passes, verified on every scan
          </p>
        </div>
      </main>

      <StudentRegisterModal isOpen={modal === "register"} onClose={() => setModal(null)} />
      <AdminLoginModal
        isOpen={modal === "admin"}
        onClose={() => setModal(null)}
        next={next}
        onSuccess={(admin) => setAdminSession(admin)}
      />
    </div>
  );
}
