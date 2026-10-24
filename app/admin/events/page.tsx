import type { Metadata } from "next";
import { EventsScreen } from "@/components/admin/screens/Events";

export const metadata: Metadata = { title: "Events" };

export default function Page() {
  return <EventsScreen />;
}
