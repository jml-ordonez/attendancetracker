import type { Metadata } from "next";
import { ScannerScreen } from "@/components/admin/screens/Scanner";

export const metadata: Metadata = { title: "Scanner" };

export default function Page() {
  return <ScannerScreen />;
}
