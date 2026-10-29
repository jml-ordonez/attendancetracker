import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_USERS } from "@/lib/auth/demo";
import { ADMIN_COOKIE, createSessionToken, sessionCookieOptions, type AdminIdentity, type StaffRole } from "@/lib/auth/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/store";
import { clientIp, jsonError, parseBody } from "@/lib/http";

const schema = z
  .object({
    username: z.string().trim().min(1, "Enter your username.").max(200).optional(),
    email: z.string().trim().optional(),
    password: z.string().min(1, "Enter your password.").max(200),
  })
  .refine((data) => Boolean(data.username || data.email), {
    message: "Enter your username.",
    path: ["username"],
  });

const MAX_FAILURES = 5;
const LOCKOUT_MS = 10 * 60 * 1000;
const SUPABASE_TIMEOUT_MS = 6500;
const STAFF_DOMAINS = ["ua.edu.ph", "university.edu", "admin.com"] as const;

const g = globalThis as unknown as {
  __ba_login_failures?: Map<string, { count: number; until: number }>;
  __ba_anon_supabase?: SupabaseClient;
};
if (!g.__ba_login_failures) g.__ba_login_failures = new Map();

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes("your-project") && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getAnonClient(): SupabaseClient {
  if (!g.__ba_anon_supabase) {
    g.__ba_anon_supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return g.__ba_anon_supabase;
}

function isStaffRole(role: unknown): role is StaffRole {
  return role === "administrator" || role === "coordinator";
}

/** Checks a single staff email in Supabase Auth with profile + metadata fallback. */
async function checkSupabaseEmail(email: string, password: string): Promise<AdminIdentity | null> {
  const supabase = getAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;

  let role: StaffRole | null = null;
  let firstName = "";
  let lastName = "";

  try {
    const db = createAdminClient();
    const { data: profile } = await db
      .from("profiles")
      .select("role, first_name, last_name")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && isStaffRole(profile.role)) {
      role = profile.role;
      firstName = profile.first_name ?? "";
      lastName = profile.last_name ?? "";
    }
  } catch {
    // Fallback to user_metadata / app_metadata if service key is unavailable.
  }

  if (!role) {
    const metaRole = data.user.app_metadata?.role ?? data.user.user_metadata?.role;
    if (isStaffRole(metaRole)) {
      role = metaRole;
      firstName = String(data.user.user_metadata?.first_name ?? "");
      lastName = String(data.user.user_metadata?.last_name ?? "");
    }
  }

  if (!role) return null;

  const fullName = `${firstName} ${lastName}`.trim() || email.split("@")[0] || "Staff Member";
  return {
    email: data.user.email || email,
    name: fullName,
    title: role === "administrator" ? "Administrator" : "Event Coordinator",
    role,
  } satisfies AdminIdentity;
}

/** Checks one or more candidate staff emails in parallel with a shared timeout. */
async function supabaseStaff(identifier: string, password: string): Promise<AdminIdentity | null> {
  if (!supabaseConfigured()) return null;
  const candidates = identifier.includes("@")
    ? [identifier]
    : STAFF_DOMAINS.map((domain) => `${identifier}@${domain}`);

  const attempt = Promise.all(
    candidates.map((email) => checkSupabaseEmail(email, password).catch(() => null))
  ).then((results) => results.find((r): r is AdminIdentity => r !== null) ?? null);

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), SUPABASE_TIMEOUT_MS));
  return Promise.race([attempt, timeout]);
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const identifier = (parsed.data.username || parsed.data.email || "").trim();
  const normalizedId = identifier.toLowerCase();
  const { password } = parsed.data;

  const failureKey = `${ip}:${normalizedId}`;
  const failures = g.__ba_login_failures!;
  const record = failures.get(failureKey);
  if (record && record.count >= MAX_FAILURES && record.until > Date.now()) {
    const minutes = Math.ceil((record.until - Date.now()) / 60000);
    return jsonError(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, 429);
  }

  // Configured admin accounts first (no network round trip)
  const matchedUser = ADMIN_USERS.find(
    (u) =>
      (u.username.toLowerCase() === normalizedId || u.email.toLowerCase() === normalizedId) &&
      u.password === password
  );

  let identity: AdminIdentity | null = matchedUser
    ? {
        email: matchedUser.email,
        name: matchedUser.name,
        title: matchedUser.title,
        role: matchedUser.role,
      }
    : null;

  if (!identity) {
    identity = await supabaseStaff(normalizedId, password);
  }

  if (!identity) {
    const next = record && record.until > Date.now() ? record.count + 1 : 1;
    failures.set(failureKey, { count: next, until: Date.now() + LOCKOUT_MS });
    logAudit({
      actor: identifier,
      actorEmail: identifier.includes("@") ? identifier : `${identifier}@local`,
      category: "auth",
      action: "auth.sign_in_failed",
      summary: "Failed staff sign-in (wrong username or password)",
      outcome: "failure",
      ip,
      details: { attempt: next },
    });
    return jsonError("Username or password is incorrect.", 401);
  }

  failures.delete(failureKey);
  logAudit({
    actor: identity.name,
    actorEmail: identity.email,
    category: "auth",
    action: "auth.sign_in",
    summary: "Signed in to the staff console",
    outcome: "success",
    ip,
  });

  const response = NextResponse.json(
    { admin: identity },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
  response.cookies.set(ADMIN_COOKIE, createSessionToken(identity), sessionCookieOptions);
  return response;
}
