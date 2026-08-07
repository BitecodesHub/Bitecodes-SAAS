import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { assertCapability } from "@/lib/server/auth/dal";
import { getChatbot } from "@/lib/server/chatbot/repository";
import { listSources } from "@/lib/server/knowledge/repository";
import { listEnabledModels } from "@/lib/server/chatbot/models";
import { getBalance } from "@/lib/server/wallet/wallet";
import { walletLedger } from "@/lib/server/db/collections";
import { KnowledgeManager } from "@/components/admin/knowledge-manager";
import { ChatbotSettings } from "@/components/admin/chatbot-settings";
import { ChatbotAppearanceEditor } from "@/components/admin/chatbot-appearance";
import {
  ChatbotUsage,
  type ChatbotUsageRow,
} from "@/components/admin/chatbot-usage";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Chatbot" };
export const dynamic = "force-dynamic";

/** Ledger rows read for the usage panel. Bounded so one busy bot cannot stall the page. */
const USAGE_ROW_LIMIT = 2_000;

export default async function ChatbotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await assertCapability("manage_chatbots");
  const { id } = await params;

  // Issued together rather than in sequence. Every query is scoped to this owner,
  // so none can leak another tenant's data if the bot turns out not to exist —
  // the ownership check lives in the query, not in this ordering.
  const [bot, sources, models, balance, ledgerRows] = await Promise.all([
    getChatbot(session.userId, id),
    listSources(session.userId, id),
    listEnabledModels(),
    getBalance(session.userId, "chatbot"),
    walletLedger().then((collection) =>
      collection
        .find(
          { ownerId: session.userId, product: "chatbot", subjectId: id },
          {
            projection: {
              delta: 1,
              kind: 1,
              refId: 1,
              note: 1,
              createdAt: 1,
              _id: 0,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(USAGE_ROW_LIMIT)
        .toArray(),
    ),
  ]);

  if (!bot) notFound();

  // Dates are serialised here rather than in the component: a Server Component
  // may not hand a Date across the boundary to a client component.
  const usageRows: ChatbotUsageRow[] = ledgerRows.map((row) => ({
    delta: row.delta,
    kind: row.kind,
    refId: row.refId ?? null,
    note: row.note ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/chatbots"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> All chatbots
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{bot.name}</h1>
          <Badge variant={bot.status === "active" ? "secondary" : "muted"}>
            {bot.status}
          </Badge>
        </div>
        {bot.websiteName && (
          <p className="text-muted-foreground mt-1 text-sm">
            {bot.websiteName}
          </p>
        )}
      </div>

      <ChatbotUsage chatbotName={bot.name} rows={usageRows} balance={balance} />

      <ChatbotSettings
        chatbotId={bot.chatbotId}
        name={bot.name}
        description={bot.description}
        websiteName={bot.websiteName}
        allowedDomains={bot.allowedDomains}
        modelKey={bot.modelKey}
        systemPrompt={bot.systemPrompt}
        status={bot.status === "active" ? "active" : "paused"}
        // Only enabled models: offering one an operator cannot use would let them
        // pin a bot to a model the gateway will silently replace at answer time.
        models={models.map((model) => ({
          key: model.key,
          label: model.label,
          provider: model.provider,
        }))}
      />

      <ChatbotAppearanceEditor
        chatbotId={bot.chatbotId}
        appearance={bot.appearance}
      />

      <KnowledgeManager
        chatbotId={bot.chatbotId}
        sources={sources.map((source) => ({
          id: source.id,
          type: source.type,
          origin: source.origin,
          status: source.status,
          chunkCount: source.chunkCount,
          error: source.error,
          createdAt: source.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
