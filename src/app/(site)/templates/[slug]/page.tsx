import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Layers,
  Palette,
} from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { TemplatePreview } from "@/components/templates/template-preview";
import { Button } from "@/components/ui/button";
import {
  getTemplate,
  launchTemplates,
  relatedTemplates,
} from "@/data/templates";
import {
  breadcrumbSchema,
  createMetadata,
  faqSchema,
  webPageSchema,
} from "@/lib/seo";

export function generateStaticParams() {
  return launchTemplates.map((template) => ({ slug: template.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const template = getTemplate(slug);
  if (!template) return createMetadata({ title: "Template not found" });
  return createMetadata({
    title: `${template.name} — ${template.industry} Website Template`,
    description: template.metaDescription,
    path: `/templates/${template.slug}`,
  });
}

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template = getTemplate(slug);
  if (!template) notFound();

  const path = `/templates/${template.slug}`;
  const related = relatedTemplates(template.slug);
  const faqs = [
    {
      question: `Is ${template.name} a free downloadable template?`,
      answer:
        "No. It is a design direction with a live preview, adapted to your content and built as a paid engagement. You are not buying a theme licence; you are commissioning a site that starts from this structure.",
    },
    {
      question: "How much does it cost to build?",
      answer:
        "A Launch website starts at $500, with a written fixed quote after a short scoping conversation. The preview shows the structure and visual direction; the final scope depends on the pages, integrations, and content work you need.",
    },
    {
      question: "Can we change the colours, copy, and sections?",
      answer:
        "Yes. The palette, typography, copy, and sections are adapted to your brand and goals. The template is a starting point, not a fixed composition.",
    },
  ];

  const contactHref = `/contact?estimate=${encodeURIComponent(
    `I would like to build a ${template.industry.toLowerCase()} website starting from the ${template.name} template. Please send a scope and fixed quote.`,
  )}`;

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Templates", path: "/templates" },
          { name: template.name, path },
        ])}
      />
      <JsonLd
        data={webPageSchema({
          path,
          name: `${template.name} template`,
          description: template.metaDescription,
          dateModified: template.updated,
        })}
      />
      <JsonLd data={faqSchema(faqs)} />

      <PageHeader
        eyebrow={`${template.industry} template`}
        title={template.name}
        description={template.tagline}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Templates", href: "/templates" },
          { name: template.name, href: path },
        ]}
        align="left"
      />

      <Section spacing="sm">
        <div className="container-page">
          <div className="text-muted-foreground mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" />
              Reviewed 22 October 2026
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <Palette className="size-4" />
              Original design direction
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <Layers className="size-4" />
              Built for Launch projects
            </span>
          </div>
          <TemplatePreview template={template} />
          <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
            The preview is illustrative. Real content, photography, and
            integrations are added during the build. Brand names and
            testimonials are placeholders.
          </p>
        </div>
      </Section>

      <Section className="border-border bg-secondary/35 border-y" spacing="sm">
        <div className="container-page grid gap-4 md:grid-cols-2">
          <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-lg font-semibold">What the build includes</h2>
            <ul className="mt-4 space-y-3">
              {template.included.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-relaxed"
                >
                  <Check className="text-primary mt-0.5 size-4 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-lg font-semibold">A good fit for</h2>
            <ul className="mt-4 space-y-3">
              {template.bestFor.map((item) => (
                <li
                  key={item}
                  className="text-muted-foreground flex items-start gap-3 text-sm leading-relaxed"
                >
                  <span
                    aria-hidden="true"
                    className="bg-primary mt-2 size-1.5 shrink-0 rounded-full"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="border-border mt-6 border-t pt-5">
              <p className="text-sm font-semibold">Published floor</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Launch websites start at $500. A written fixed quote follows a
                short scoping conversation, before any work begins.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight">
            From preview to launch
          </h2>
          <ol className="mt-8 space-y-4">
            {[
              {
                title: "Tell us the outcome",
                text: `Send the template name and the job the site must do — book appointments, take reservations, or earn trials.`,
              },
              {
                title: "Scope and fixed quote",
                text: "A short call confirms the pages, content, integrations, and timeline. You receive a written scope with a fixed price.",
              },
              {
                title: "Adapt and build",
                text: `We apply your brand and content, adjust the sections, and build the responsive site with accessibility and SEO from the start.`,
              },
              {
                title: "Launch and hand over",
                text: "We deploy, connect analytics, test the conversion path, and hand over the repository and documentation.",
              },
            ].map((step, index) => (
              <li
                key={step.title}
                className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
              >
                <p className="font-medium">
                  <span className="text-muted-foreground mr-2 tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {step.title}
                </p>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>

          <div className="border-primary/25 bg-primary/5 mt-8 rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">
              Start from {template.name}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Tell us what the site needs to achieve. We will reply with a
              realistic scope and a fixed quote — not a template licence.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={contactHref} data-track="template-start">
                  Start from this template
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/website-development-cost-calculator">
                  Estimate the cost
                </Link>
              </Button>
            </div>
          </div>

          <div className="border-border mt-12 border-t pt-10">
            <h2 className="text-2xl font-semibold tracking-tight">
              Questions about templates
            </h2>
            <dl className="mt-6 space-y-6">
              {faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="font-medium">{faq.question}</dt>
                  <dd className="text-muted-foreground mt-2 leading-relaxed">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-border mt-10 border-t pt-6">
            <Link
              href="/templates"
              className="text-primary inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline"
            >
              <ArrowLeft className="size-4" />
              All templates
            </Link>
          </div>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <h2 className="text-xl font-semibold tracking-tight">
              Other directions
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/templates/${item.slug}`}
                  className="group border-border bg-card hover:border-primary/30 rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-colors"
                  data-track="template-related"
                >
                  <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
                    {item.industry}
                  </p>
                  <h3 className="group-hover:text-primary mt-2 font-semibold">
                    {item.name}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {item.tagline}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      ) : null}
    </>
  );
}
