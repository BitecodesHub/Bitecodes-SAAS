import type { Metadata } from "next";
import { FormDetailScreen } from "@/components/product/screens";

/**
 * The staff view of one record. A wrapper around the screen shared with `/app`
 * — see `components/product/screens.tsx`.
 */
export const metadata: Metadata = { title: "Form" };
export const dynamic = "force-dynamic";

export default async function AdminFormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FormDetailScreen basePath="/admin" id={id} />;
}
