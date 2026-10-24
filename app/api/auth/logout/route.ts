import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { logAudit } from "@/lib/audit/store";
import { clientIp, getAdmin } from "@/lib/http";

export async function POST(request: NextRequest) {
  const admin = getAdmin(request);
  if (admin) {
    logAudit({
      actor: admin.name,
      actorEmail: admin.email,
      category: "auth",
      action: "auth.sign_out",
      summary: "Signed out",
      outcome: "success",
      ip: clientIp(request),
    });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
