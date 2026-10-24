import type { Metadata } from "next";
import { CoordinatorScreen } from "@/components/admin/screens/Coordinator";

export const metadata: Metadata = { title: "Coordinator view" };

export default function Page() {
  return <CoordinatorScreen />;
}
