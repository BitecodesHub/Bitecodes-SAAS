import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasCapability, requireCapability } from "@/lib/server/auth/dal";
import { getTemplate } from "@/lib/server/email/templates";
import { OUTREACH_VARIABLES } from "@/lib/email/templates/outreach";
import { PROSPECT_TAG_LABELS } from "@/lib/prospecting/classify";
import { getSettingsFresh } from "@/lib/server/settings";
import { TemplateEditor } from "@/components/admin/template-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProspectTag } from "@/lib/server/db/types";

export const metadata: Metadata = { title: "Edit template" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ key: string }>;
}

export default async function TemplatePage({ params }: PageProps) {
  await requireCapability("manage_settings");
  const { key } = await params;

  // The key travels in the URL and contains a dot (`outreach.no-website`), so it
  // arrives percent-encoded from the link.
  const templateKey = decodeURIComponent(key);
  const template = await getTemplate(templateKey);
  if (!template) notFound();

  const [canSend, settings] = await Promise.all([
    hasCapability("send_email"),
    getSettingsFresh(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/email">
            <ArrowLeft className="size-4" />
            All email
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {template.name}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            {template.description}
          </p>
        </div>
        {template.prospectTag && (
          <Badge variant="outline">
            Sent to customers tagged{" "}
            {PROSPECT_TAG_LABELS[template.prospectTag as ProspectTag] ??
              template.prospectTag}
          </Badge>
        )}
      </header>

      <TemplateEditor
        templateKey={template.key}
        initial={{
          name: template.name,
          description: template.description,
          subject: template.subject,
          blocks: template.blocks,
          enabled: template.enabled,
          isDefault: template.isDefault,
        }}
        variables={OUTREACH_VARIABLES}
        canSend={canSend}
        // Defaults to where internal notifications already go, which is almost
        // always the operator's own inbox.
        defaultTestAddress={settings.contact.salesEmail}
      />
    </div>
  );
}
