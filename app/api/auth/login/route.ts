import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_USERS, DEMO_ADMIN } from "@/lib/auth/demo";
import { ADMIN_COOKIE, createSessionToken, sessionCookieOptions, type AdminIdentity } from "@/lib/auth/admin-session";
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
const SUPABASE_TIMEOUT_MS = 5000;

const g = globalThis as unknown as { __ba_login_failures?: Map<string, { count: number; until: number }> };
if (!g.__ba_login_failures) g.__ba_login_failures = new Map();

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes("your-project") && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Checks a real staff account in Supabase Auth, with a hard timeout so a slow network can't hang sign-in. */
async function supabaseStaff(email: string, password: string): Promise<AdminIdentity | null> {
  if (!supabaseConfigured()) return null;
  const attempt = (async () => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    const { data: profile } = await createAdminClient()
      .from("profiles")
      .select("role, first_name, last_name")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profile || (profile.role !== "administrator" && profile.role !== "coordinator")) return null;
    return {
      email,
      name: `${profile.first_name} ${profile.last_name}`.trim(),
      title: profile.role === "administrator" ? "Administrator" : "Event Coordinator",
      role: profile.role,
    } satisfies AdminIdentity;
  })();
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), SUPABASE_TIMEOUT_MS));
  return Promise.race([attempt.catch(() => null), timeout]);
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const failures = g.__ba_login_failures!;
  const record = failures.get(ip);
  if (record && record.count >= MAX_FAILURES && record.until > Date.now()) {
    const minutes = Math.ceil((record.until - Date.now()) / 60000);
    return jsonError(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, 429);
  }

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const identifier = (parsed.data.username || parsed.data.email || "").trim();
  const { password } = parsed.data;

  // Configured admin accounts first (no network round trip)
  const normalizedId = identifier.toLowerCase();
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

  if (!identity && identifier.includes("@")) {
    identity = await supabaseStaff(identifier, password);
  }

  if (!identity) {
    const next = record && record.until > Date.now() ? record.count + 1 : 1;
    failures.set(ip, { count: next, until: Date.now() + LOCKOUT_MS });
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

  failures.delete(ip);
  logAudit({
    actor: identity.name,
    actorEmail: identity.email,
    category: "auth",
    action: "auth.sign_in",
    summary: "Signed in to the staff console",
    outcome: "success",
    ip,
  });

  const response = NextResponse.json({ admin: identity });
  response.cookies.set(ADMIN_COOKIE, createSessionToken(identity), sessionCookieOptions);
  return response;
}
