import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth/admin-session";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" aria-busy="true" />}>
      <SignedIn>{children}</SignedIn>
    </Suspense>
  );
}

/** `proxy.ts` already turns away visitors without a session; this reads who is signed in. */
async function SignedIn({ children }: { children: React.ReactNode }) {
  // Request-time only: the session check reads the clock (expiry), which must never be prerendered.
  await connection();
  const admin = verifySessionToken((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!admin) redirect("/?auth=admin");
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
