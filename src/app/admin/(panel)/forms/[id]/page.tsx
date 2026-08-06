import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { assertCapability } from "@/lib/server/auth/dal";
import { getForm, listSubmissions } from "@/lib/server/forms/repository";
import { getBalance } from "@/lib/server/wallet/wallet";
import { FormBuilder } from "@/components/admin/form-builder";
import { FormSubmissions } from "@/components/admin/form-submissions";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Form" };
export const dynamic = "force-dynamic";

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await assertCapability("manage_forms");
  const { id } = await params;
  const form = await getForm(session.userId, id);
  if (!form) notFound();

  const [submissions, credits] = await Promise.all([
    listSubmissions(session.userId, id, { limit: 100 }),
    getBalance(session.userId, "forms"),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/forms"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> All forms
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {form.name}
          <Badge variant={form.status === "active" ? "secondary" : "muted"}>
            {form.status}
          </Badge>
        </h1>
        <p className="text-muted-foreground text-sm">
          {form.submissionCount} total submission
          {form.submissionCount === 1 ? "" : "s"} · {credits} credit
          {credits === 1 ? "" : "s"} remaining ·{" "}
          {form.allowedDomains.length
            ? `runs on ${form.allowedDomains.join(", ")}`
            : "no domains configured yet"}
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Fields</h2>
        <p className="text-muted-foreground mt-1 mb-4 max-w-2xl text-sm">
          The field name is the key stored on each submission and used in the
          CSV export. Changing it does not rewrite past submissions.
        </p>
        <FormBuilder formId={form.formId} initialFields={form.fields} />
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Submissions</h2>
        <div className="mt-4">
          <FormSubmissions
            formId={form.formId}
            columns={form.fields.map((f) => f.name)}
            submissions={submissions.map((s) => ({
              submissionId: s.submissionId,
              createdAt: s.createdAt.toISOString(),
              status: s.status,
              data: s.data,
            }))}
          />
        </div>
      </section>
    </div>
  );
}
