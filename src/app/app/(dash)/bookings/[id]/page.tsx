import type { Metadata } from "next";
import { BookingDetailScreen } from "@/components/product/screens";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingDetailScreen basePath="/app" id={id} />;
}
