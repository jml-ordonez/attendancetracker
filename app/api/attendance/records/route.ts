import { NextResponse, type NextRequest } from "next/server";
import { clearScans, listScans } from "@/lib/attendance/store";
import { logAudit } from "@/lib/audit/store";
import { clientIp, requireAdmin } from "@/lib/http";

export async function GET(request: NextRequest) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const records = listScans();
  return NextResponse.json({ records, count: records.length, serverTime: new Date().toISOString() });
}

/** Clears every scan. Was public and linked from the landing page; now staff-only and audited. */
export async function DELETE(request: NextRequest) {
  const admin = requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const count = clearScans();
  logAudit({
    actor: admin.name,
    actorEmail: admin.email,
    category: "records",
    action: "records.cleared",
    summary: `Cleared all attendance records (${count} scan${count === 1 ? "" : "s"})`,
    outcome: "success",
    ip: clientIp(request),
    details: { count },
  });
  return NextResponse.json({ records: [], count: 0 });
}
