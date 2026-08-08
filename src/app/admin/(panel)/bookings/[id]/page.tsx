import type { Metadata } from "next";
import { BookingDetailScreen } from "@/components/product/screens";

/**
 * The staff view of one record. A wrapper around the screen shared with `/app`
 * — see `components/product/screens.tsx`.
 */
export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingDetailScreen basePath="/admin" id={id} />;
}
