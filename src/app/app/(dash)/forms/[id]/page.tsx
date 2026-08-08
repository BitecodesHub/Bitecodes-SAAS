import type { Metadata } from "next";
import { FormDetailScreen } from "@/components/product/screens";

export const metadata: Metadata = { title: "Form" };
export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FormDetailScreen basePath="/app" id={id} />;
}
