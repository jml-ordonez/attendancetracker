import type { Metadata } from "next";
import { RecordsScreen } from "@/components/admin/screens/Records";

export const metadata: Metadata = { title: "Attendance records" };

export default function Page() {
  return <RecordsScreen />;
}
