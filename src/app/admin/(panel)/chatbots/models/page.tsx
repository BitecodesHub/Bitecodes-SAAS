import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import { listModels } from "@/lib/server/chatbot/models";
import { ModelCatalog } from "@/components/admin/model-catalog";

export const metadata: Metadata = { title: "Chatbot models" };
export const dynamic = "force-dynamic";

/**
 * Admin model catalogue. Gated by `manage_settings` (not `manage_chatbots`):
 * enabling a model and setting per-token costs is a platform-economics
 * decision, above day-to-day bot management.
 */
export default async function ChatbotModelsPage() {
  await requireCapability("manage_settings");
  const models = await listModels();

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

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI models</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Choose which models customers can select, set per-token costs (used to
          price token usage), and pick the default. Customers only ever see
          enabled models.
        </p>
      </header>

      <ModelCatalog
        models={models.map((m) => ({
          key: m.key,
          label: m.label,
          provider: m.provider,
          inCostPerMTok: m.inCostPerMTok,
          outCostPerMTok: m.outCostPerMTok,
          maxContext: m.maxContext,
          enabled: m.enabled,
          isDefault: m.isDefault,
        }))}
      />
    </div>
  );
}
