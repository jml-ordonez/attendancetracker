import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth/admin-session";

/**
 * Staff pages require a valid session cookie, checked before the page renders,
 * so there is no blank flash while the client checks and no way to open the
 * console by typing its URL. Runs only on /admin; the old middleware ran a
 * no-op on every request, including every API call.
 */
export function proxy(request: NextRequest) {
  if (verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("auth", "admin");
  url.searchParams.set("next", request.nextUrl.pathname);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
