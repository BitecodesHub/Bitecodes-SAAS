import type { Metadata } from "next";
import Link from "next/link";
import { assertCapability } from "@/lib/server/auth/dal";
import { listForms } from "@/lib/server/forms/repository";
import { getBalance } from "@/lib/server/wallet/wallet";
import { FormsManager } from "@/components/admin/forms-manager";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Forms" };
export const dynamic = "force-dynamic";

export default async function AdminFormsPage() {
  const session = await assertCapability("manage_forms");
  const [forms, credits] = await Promise.all([
    listForms(session.userId),
    getBalance(session.userId, "forms"),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Build a form, choose which domains may use it, and paste one line on
          any website. Submissions land here and are emailed to you — see the
          product page at{" "}
          <Link
            href="/forms"
            className="text-primary underline-offset-2 hover:underline"
          >
            /forms
          </Link>
          .
        </p>
      </header>

      <FormsManager
        siteUrl={siteConfig.url}
        credits={credits}
        forms={forms.map((f) => ({
          formId: f.formId,
          name: f.name,
          status: f.status,
          allowedDomains: f.allowedDomains,
          submissionCount: f.submissionCount,
          fieldCount: f.fields.length,
        }))}
      />
    </div>
  );
}
