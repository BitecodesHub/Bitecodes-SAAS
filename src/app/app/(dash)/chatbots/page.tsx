import type { Metadata } from "next";
import { ChatbotsScreen } from "@/components/product/screens";

/**
 * The customer's own chatbots. Renders the same screen as `/admin/chatbots` — see
 * `components/product/screens.tsx` for why there is only one of them.
 */
export const metadata: Metadata = { title: "Chatbots" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ChatbotsScreen basePath="/app" />;
}
