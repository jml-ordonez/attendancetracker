import type { Metadata } from "next";
import { AuditLogScreen } from "@/components/admin/screens/AuditLog";

export const metadata: Metadata = { title: "Audit log" };

export default function Page() {
  return <AuditLogScreen />;
}
