import type { Metadata } from "next";
import { getFormForPublic } from "@/lib/server/forms/repository";
import { FormRenderer } from "@/components/forms/form-renderer";
import { HONEYPOT_FIELD } from "@/lib/forms/fields";

/**
 * Hosted, standalone rendering of one customer form — the iframe target for
 * embedders who prefer not to run our script.
 *
 * Server-rendered from the form's own definition, resolved by id plus the public
 * token in `?t=`. No session is read and no authenticated action is possible
 * here, which is what makes it safe to allow any site to frame it (see the
 * `frame-ancestors` exemption in `next.config.ts`).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Form",
  robots: { index: false, follow: false },
};

export default async function HostedFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { formId } = await params;
  const { t } = await searchParams;
  const form = t ? await getFormForPublic(formId, t) : null;

  if (!form) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="border-border bg-card rounded-xl border p-5 text-sm leading-relaxed">
          <p className="font-medium">This form is not available.</p>
          <p className="text-muted-foreground mt-1">
            The link may be incomplete, or the form may have been paused by its
            owner.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold tracking-tight">{form.name}</h1>
      {form.description && (
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          {form.description}
        </p>
      )}
      <div className="mt-6">
        <FormRenderer
          formId={form.formId}
          publicToken={t!}
          fields={form.fields}
          appearance={form.appearance}
          honeypotField={form.honeypotEnabled ? HONEYPOT_FIELD : null}
          thankYouMessage={form.thankYouMessage}
          redirectUrl={form.redirectUrl}
        />
      </div>
    </main>
  );
}
