import type { Metadata } from "next";
import { BookingsScreen } from "@/components/product/screens";

/**
 * The customer's own calendars. Renders the same screen as `/admin/bookings` — see
 * `components/product/screens.tsx` for why there is only one of them.
 */
export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <BookingsScreen basePath="/app" />;
}
