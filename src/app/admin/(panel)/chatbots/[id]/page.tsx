import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { assertCapability } from "@/lib/server/auth/dal";
import { getChatbot } from "@/lib/server/chatbot/repository";
import { listSources } from "@/lib/server/knowledge/repository";
import { KnowledgeManager } from "@/components/admin/knowledge-manager";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Chatbot" };
export const dynamic = "force-dynamic";

export default async function ChatbotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await assertCapability("manage_chatbots");
  const { id } = await params;
  const bot = await getChatbot(session.userId, id);
  if (!bot) notFound();

  const sources = await listSources(session.userId, id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/chatbots"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> All chatbots
        </Link>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {bot.name}
            <Badge variant={bot.status === "active" ? "secondary" : "muted"}>
              {bot.status}
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            {bot.allowedDomains.length
              ? `Runs on: ${bot.allowedDomains.join(", ")}`
              : "No domains configured yet."}
          </p>
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Knowledge base</h2>
        <p className="text-muted-foreground mt-1 mb-4 max-w-2xl text-sm">
          What this chatbot can answer from. Add content below; it is chunked
          and indexed straight away.
        </p>
        <KnowledgeManager
          chatbotId={bot.chatbotId}
          sources={sources.map((s) => ({
            id: s.id,
            origin: s.origin,
            type: s.type,
            status: s.status,
            chunkCount: s.chunkCount,
            error: s.error,
          }))}
        />
      </section>
    </div>
  );
}
