"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ChevronRight, Lock, PencilLine, QrCode, ShieldCheck } from "lucide-react";
import { StudentRegisterModal } from "@/components/auth/StudentRegisterModal";
import AdminLoginModal from "@/components/auth/AdminLoginModal";
import { PassPreview } from "@/components/landing/PassPreview";
import { BrandLockup } from "@/components/ui/BrandMark";
import { btn } from "@/components/ui/styles";
import { clearStudentRegistration, useRegisteredStudent } from "@/lib/auth/session";
import { MAJOR_SHORT } from "@/lib/validation";
import auditorium from "@/public/images/auditorium.jpg";

type ModalKind = "register" | "admin" | null;

/** Facts about how the system works, not marketing figures. */
const FACTS = [
  ["45s", "code rotation"],
  ["1×", "scan per code"],
  ["4", "BSBA majors"],
] as const;

const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default function LandingPage() {
  const [modal, setModal] = useState<ModalKind>(null);
  const [next, setNext] = useState<string | null>(null);
  const student = useRegisteredStudent();
  const ready = student !== undefined;

  // Deep links: /?auth=admin&next=/admin/records (from the route guard) or /?auth=student.
  // The URL is outside React, so it is read once after mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    if (!auth) return;
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL
    setNext(params.get("next"));
    setModal(auth === "admin" ? "admin" : auth === "student" ? "register" : null);
  }, []);

  return (
    <div className="grid min-h-dvh bg-card lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ---------- The room: photograph, title and the live pass ---------- */}
      <section className="relative order-2 isolate flex flex-col overflow-hidden bg-brand-deep text-white lg:order-1 lg:min-h-dvh">
        <Image
          src={auditorium}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="animate-ken-burns -z-20 object-cover opacity-70 mix-blend-luminosity grayscale"
        />
        {/* Scrim: keeps the type readable over the photograph. */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(14,42,107,0.96)_25%,rgba(14,42,107,0.7)_60%,rgba(14,42,107,0.35))]" aria-hidden="true" />

        <div className="flex flex-1 flex-col px-6 py-10 sm:px-10 lg:px-14 lg:py-12 xl:px-16">
          <div className="hidden lg:block">
            <BrandLockup inverted />
          </div>

          <div className="flex flex-1 flex-col justify-center gap-14 py-4 lg:py-14 xl:flex-row xl:items-center xl:justify-between xl:gap-10">
            <div className="max-w-md xl:min-w-[23rem] xl:flex-1">
              <h1 className="font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.025em] sm:text-[3.5rem] xl:text-[3.375rem] 2xl:text-[3.875rem]">
                <span className="animate-rise block">Every seat,</span>
                <span className="animate-rise block text-brand-light" style={rise(1)}>
                  accounted for.
                </span>
              </h1>
              <p className="animate-rise mt-6 max-w-sm text-lg leading-relaxed text-white/80" style={rise(2)}>
                Encrypted QR attendance for Business Administration seminars and assemblies.
              </p>
            </div>

            <div className="animate-rise flex justify-center pb-6 xl:pb-0 xl:pr-4" style={rise(3)}>
              <PassPreview />
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
            {FACTS.map(([value, label], i) => (
              <div key={label} className="animate-rise" style={rise(i + 4)}>
                <dt className="sr-only">{label}</dt>
                <dd className="figures font-display text-[1.875rem] font-semibold leading-none sm:text-[2.25rem]">{value}</dd>
                <dd className="mt-1.5 text-sm text-white/70">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- Access ---------- */}
      <main className="order-1 flex flex-col px-5 py-8 sm:px-10 lg:order-2 lg:px-14 lg:py-12 xl:px-20">
        <div className="flex items-center justify-between gap-4">
          <BrandLockup className="lg:invisible" />
          <p className="figures hidden whitespace-nowrap text-sm text-muted sm:block">AY 2026–2027 · 1st Semester</p>
        </div>

        <div className="mx-auto flex w-full max-w-[27rem] flex-1 flex-col justify-center py-10">
          <h2 className="animate-rise font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight">Welcome</h2>
          <p className="animate-rise mt-2 text-[17px] text-ink-soft" style={rise(1)}>
            Students get a pass. Staff run the door.
          </p>

          {/* Student */}
          <article className="lift animate-rise mt-8 overflow-hidden rounded-2xl border border-brand/20 bg-card" style={rise(2)} aria-labelledby="student-h">
            <div className="relative bg-brand px-6 pb-5 pt-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="student-h" className="font-display text-[1.375rem] font-semibold leading-tight">
                    Students
                  </h3>
                  <p className="mt-1 text-[15px] text-white/80">{student ? "Your pass is ready on this device." : "No account or password needed."}</p>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15" aria-hidden="true">
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
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-base font-semibold text-white" aria-hidden="true">
                      {student.firstName.charAt(0)}
                      {student.lastName.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        {student.fullName}
                        <BadgeCheck className="h-4 w-4 shrink-0 text-brand" aria-label="Registered" />
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
                    <button type="button" onClick={() => setModal("register")} className="press inline-flex h-10 items-center gap-1.5 rounded-md px-2 font-semibold text-brand hover:bg-brand-tint">
                      <PencilLine className="h-4 w-4" aria-hidden="true" />
                      Edit details
                    </button>
                    <button type="button" onClick={clearStudentRegistration} className="press h-10 rounded-md px-2 text-muted hover:text-rose">
                      Not you? Remove
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="leading-relaxed text-ink-soft">Register your student ID once, then show your pass at the door.</p>
                  <button type="button" onClick={() => setModal("register")} className={`${btn.primary} group mt-5 h-12 w-full text-[15px]`}>
                    Get my attendance pass
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </article>

          {/* Staff */}
          <button
            type="button"
            onClick={() => setModal("admin")}
            className="lift animate-rise group mt-4 flex w-full items-center gap-4 rounded-2xl border border-line bg-card p-5 text-left hover:border-brand/40"
            style={rise(3)}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paper text-ink-soft transition-colors group-hover:bg-brand-soft group-hover:text-brand" aria-hidden="true">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold text-ink">Faculty and staff</span>
              <span className="block text-sm text-ink-soft">Scanner, events, records and reports</span>
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-brand">
              Sign in
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </button>

          <p className="animate-rise mt-8 flex items-center justify-center gap-2 text-sm text-muted" style={rise(4)}>
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Encrypted, single-use passes, verified on every scan
          </p>
        </div>
      </main>

      <StudentRegisterModal isOpen={modal === "register"} onClose={() => setModal(null)} />
      <AdminLoginModal isOpen={modal === "admin"} onClose={() => setModal(null)} next={next} />
    </div>
  );
}
