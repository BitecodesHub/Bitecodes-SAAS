import type { Metadata } from "next";
import { ChatbotDetailScreen } from "@/components/product/screens";

/**
 * The staff view of one record. A wrapper around the screen shared with `/app`
 * — see `components/product/screens.tsx`.
 */
export const metadata: Metadata = { title: "Chatbot" };
export const dynamic = "force-dynamic";

export default async function AdminChatbotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatbotDetailScreen basePath="/admin" id={id} />;
}
