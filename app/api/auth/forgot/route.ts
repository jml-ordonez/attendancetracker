import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit/store";
import { clientIp, parseBody } from "@/lib/http";
import { EMAIL_PATTERN } from "@/lib/validation";

const schema = z.object({ email: z.string().trim().toLowerCase().regex(EMAIL_PATTERN, "Enter a valid email address.") });

/**
 * Sends a Supabase password-reset email when Supabase is configured. Always
 * answers the same way, so the form can't be used to find out which emails
 * have staff accounts.
 */
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;
  const { email } = parsed.data;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key && !url.includes("your-project")) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/?auth=admin`;
    await Promise.race([
      supabase.auth.resetPasswordForEmail(email, { redirectTo }).catch(() => null),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
  }

  logAudit({
    actor: email,
    actorEmail: email,
    category: "auth",
    action: "auth.password_reset_requested",
    summary: `Password reset requested for ${email}`,
    outcome: "success",
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}
