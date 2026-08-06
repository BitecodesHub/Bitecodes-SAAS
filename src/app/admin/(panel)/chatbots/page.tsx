import type { Metadata } from "next";
import Link from "next/link";
import { assertCapability } from "@/lib/server/auth/dal";
import { listChatbots } from "@/lib/server/chatbot/repository";
import { ChatbotManager } from "@/components/admin/chatbot-manager";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Chatbots" };
export const dynamic = "force-dynamic";

export default async function AdminChatbotsPage() {
  const session = await assertCapability("manage_chatbots");
  const bots = await listChatbots(session.userId);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Chatbots</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Create an embeddable AI chatbot, set the domains it may run on, and
          copy its one-line snippet. Training, models, and analytics build on
          this — see the product page at{" "}
          <Link
            href="/ai-chatbot"
            className="text-primary underline-offset-2 hover:underline"
          >
            /ai-chatbot
          </Link>
          .
        </p>
      </header>

      <ChatbotManager
        siteUrl={siteConfig.url}
        chatbots={bots.map((b) => ({
          chatbotId: b.chatbotId,
          name: b.name,
          status: b.status,
          websiteName: b.websiteName,
          allowedDomains: b.allowedDomains,
        }))}
      />
    </div>
  );
}
