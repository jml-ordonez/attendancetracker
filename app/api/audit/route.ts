import { NextResponse, type NextRequest } from "next/server";
import { listAudit } from "@/lib/audit/store";
import { requireAdmin } from "@/lib/http";

export async function GET(request: NextRequest) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const limit = Math.min(1000, Number(request.nextUrl.searchParams.get("limit")) || 500);
  const entries = listAudit().slice(0, limit);
  return NextResponse.json({ entries, total: listAudit().length });
}
