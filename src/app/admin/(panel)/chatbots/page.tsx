import type { Metadata } from "next";
import Link from "next/link";
import { assertCapability } from "@/lib/server/auth/dal";
import { listChatbots } from "@/lib/server/chatbot/repository";
import { ChatbotManager } from "@/components/admin/chatbot-manager";
import { CreditsPanel } from "@/components/admin/credits-panel";
import { getBalance } from "@/lib/server/wallet/wallet";
import {
  formatPackPrice,
  packsFor,
  perUnitPrice,
} from "@/lib/server/billing/packs";
import { getActiveProvider } from "@/lib/server/billing/orders";
import { can } from "@/lib/server/auth/roles";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Chatbots" };
export const dynamic = "force-dynamic";

export default async function AdminChatbotsPage() {
  const session = await assertCapability("manage_chatbots");
  const [bots, tokens] = await Promise.all([
    listChatbots(session.userId),
    getBalance(session.userId, "chatbot"),
  ]);

  const packs = packsFor("chatbot").map((pack) => ({
    packId: pack.packId,
    label: pack.label,
    credits: pack.credits,
    price: formatPackPrice(pack),
    perUnit: perUnitPrice(pack),
    blurb: pack.blurb,
    popular: Boolean(pack.popular),
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Chatbots</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Create an embeddable AI chatbot, set the domains it may run on, and
            copy its one-line snippet. Open a bot to add its knowledge base —
            see the product page at{" "}
            <Link
              href="/ai-chatbot"
              className="text-primary underline-offset-2 hover:underline"
            >
              /ai-chatbot
            </Link>
            .
          </p>
        </div>
        <Link
          href="/admin/chatbots/models"
          className="text-primary text-sm underline-offset-2 hover:underline"
        >
          Manage AI models →
        </Link>
      </header>

      <CreditsPanel
        product="chatbot"
        packs={packs}
        balance={tokens}
        canGrant={can(session.role, "manage_settings")}
        gatewayLive={getActiveProvider().id !== "manual"}
      />

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
