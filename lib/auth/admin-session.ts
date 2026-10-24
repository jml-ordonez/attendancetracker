import crypto from "crypto";

/**
 * Signed, httpOnly staff session cookie.
 *
 * Replaces the old localStorage flag, which the server could not see: every
 * admin API was open, and pages had to render blank until the client checked
 * storage. The cookie is verified in `proxy.ts` before an /admin page renders
 * and by every admin route handler.
 */

export const ADMIN_COOKIE = "ba_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

export type StaffRole = "administrator" | "coordinator";

export interface AdminIdentity {
  email: string;
  name: string;
  title: string;
  role: StaffRole;
}

interface SessionPayload extends AdminIdentity {
  exp: number;
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.QR_HMAC_SECRET_KEY || "ba-attendance-dev-session-secret";
}

function sign(body: string): string {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createSessionToken(identity: AdminIdentity, now = Date.now()): string {
  const payload: SessionPayload = { ...identity, exp: Math.floor(now / 1000) + ADMIN_SESSION_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | null | undefined, now = Date.now()): AdminIdentity | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof p.exp !== "number" || p.exp * 1000 <= now) return null;
    return { email: p.email, name: p.name, title: p.title, role: p.role };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: ADMIN_SESSION_TTL_SECONDS,
};
