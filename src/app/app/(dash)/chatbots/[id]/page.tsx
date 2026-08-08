import type { Metadata } from "next";
import { ChatbotDetailScreen } from "@/components/product/screens";

export const metadata: Metadata = { title: "Chatbot" };
export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatbotDetailScreen basePath="/app" id={id} />;
}
