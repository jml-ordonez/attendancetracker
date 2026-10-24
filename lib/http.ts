import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { ADMIN_COOKIE, verifySessionToken, type AdminIdentity } from "@/lib/auth/admin-session";
import { fieldErrors } from "@/lib/validation";

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** The signed-in staff member, or a 401 response to return as-is. */
export function requireAdmin(request: NextRequest): AdminIdentity | NextResponse {
  const admin = verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
  return admin ?? jsonError("Your session has ended. Sign in again.", 401);
}

export function getAdmin(request: NextRequest): AdminIdentity | null {
  return verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

/** Parses a JSON body against a schema; on failure returns a 400 with per-field messages. */
export async function parseBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): Promise<{ data: z.infer<T> } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { response: jsonError("The request body must be JSON.", 400) };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const errors = fieldErrors(result.error);
    return { response: jsonError(Object.values(errors)[0] ?? "Check the highlighted fields.", 400, { fieldErrors: errors }) };
  }
  return { data: result.data };
}
