"use client";

import React, { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardCheck,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  ScanLine,
  Table2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/ui/BrandMark";
import { AdminDataProvider } from "@/components/admin/AdminData";
import type { AdminIdentity } from "@/lib/auth/admin-session";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Operations",
    items: [
      { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Scanner", href: "/admin/scanner", icon: ScanLine },
      { label: "Coordinator view", href: "/admin/coordinator", icon: ClipboardCheck },
    ],
  },
  {
    group: "Records",
    items: [
      { label: "Attendance records", href: "/admin/records", icon: Table2 },
      { label: "Events", href: "/admin/events", icon: CalendarDays },
    ],
  },
  {
    group: "Governance",
    items: [{ label: "Audit log", href: "/admin/audit-log", icon: History }],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

function initials(name: string) {
  return name
    .replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Staff console frame: one sidebar and one signed-in identity across every admin screen. */
export function AdminShell({ admin, children }: { admin: AdminIdentity; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close the drawer whenever the route changes (including back/forward).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
  }
  // And when Next hides this tree with Activity, so it doesn't come back open.
  useLayoutEffect(() => () => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const current = ALL_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));

  const signOut = async () => {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    // A full load, so no staff screen stays alive in the client router's memory.
    window.location.replace("/");
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between gap-3 px-5">
        <Link href="/admin/dashboard" className="flex min-w-0 items-center gap-3">
          <BrandMark />
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-[15px] font-semibold text-ink">BA Attendance</span>
            <span className="block truncate text-xs text-muted">Business Administration</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
          className="press flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-brand-tint hover:text-ink lg:hidden"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Staff console" className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
        {NAV.map((group) => (
          <div key={group.group} className="mb-5">
            <p className="px-3 pb-1.5 text-xs font-medium text-muted">{group.group}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item === current;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "press flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                        active
                          ? "bg-brand-soft font-semibold text-brand-dark"
                          : "font-medium text-ink-soft hover:bg-brand-tint hover:text-ink"
                      )}
                    >
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-brand" : "text-muted")} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-dark"
            aria-hidden="true"
          >
            {initials(admin.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{admin.name}</p>
            <p className="truncate text-xs text-muted">{admin.title}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="press mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line-strong text-sm font-medium text-ink-soft hover:border-rose/40 hover:bg-rose-soft hover:text-rose disabled:opacity-60"
        >
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <AdminDataProvider admin={admin}>
      <div className="flex h-dvh overflow-hidden bg-paper">
        {/* Desktop rail */}
        <aside className="hidden w-64 shrink-0 border-r border-line bg-card lg:block">{sidebar}</aside>

        {/* Mobile drawer */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-ink/40 transition-opacity duration-200 lg:hidden",
            menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
        <aside
          aria-hidden={!menuOpen}
          inert={!menuOpen}
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 bg-card shadow-xl transition-transform duration-200 ease-out lg:hidden",
            menuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebar}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-card px-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="press flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-brand-tint"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <BrandMark className="h-7 w-7" />
            <span className="truncate text-sm font-semibold">{current?.label ?? "BA Attendance"}</span>
          </header>
          <main id="main" className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminDataProvider>
  );
}
