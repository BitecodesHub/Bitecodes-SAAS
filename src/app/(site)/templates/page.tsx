import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Layers, MousePointerClick, Sparkles } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { launchTemplates } from "@/data/templates";
import { breadcrumbSchema, createMetadata, webPageSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Website Templates for Clinics, Restaurants & SaaS — Live Previews",
  description:
    "Explore three original website design directions with live, responsive previews: a clinic, a restaurant, and a SaaS product. Start from one and make it yours.",
  path: "/templates",
});

export default function TemplatesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Templates", path: "/templates" },
        ])}
      />
      <JsonLd
        data={webPageSchema({
          path: "/templates",
          name: "Launch templates",
          description:
            "Three original website design directions with live previews for healthcare, hospitality, and SaaS.",
        })}
      />
      <PageHeader
        eyebrow="Launch templates"
        title={
          <>
            A head start that still looks <span>yours.</span>
          </>
        }
        description="Three considered design directions, previewed live and built around a real business goal. Pick one as the starting point for a Launch project and we adapt it to your content, brand, and workflow."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Templates", href: "/templates" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page">
          <div className="grid gap-5 lg:grid-cols-3">
            {launchTemplates.map((template, index) => (
              <Reveal key={template.slug} delay={index * 60}>
                <Link
                  href={`/templates/${template.slug}`}
                  className="group border-border bg-card hover:border-primary/30 flex h-full flex-col overflow-hidden rounded-3xl border shadow-[var(--shadow-soft)] transition-colors"
                  data-track="template-card"
                >
                  <TemplateThumbnail
                    accent={template.palette.accent}
                    accentSoft={template.palette.accentSoft}
                    surface={template.palette.surface}
                    bg={template.palette.bg}
                    ink={template.palette.ink}
                    border={template.palette.border}
                  />
                  <div className="flex flex-1 flex-col p-6">
                    <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
                      {template.industry}
                    </p>
                    <h2 className="group-hover:text-primary mt-2 text-xl font-semibold">
                      {template.name}
                    </h2>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {template.tagline}
                    </p>
                    <ul className="mt-4 space-y-1.5">
                      {template.bestFor.slice(0, 2).map((item) => (
                        <li
                          key={item}
                          className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed"
                        >
                          <span
                            aria-hidden="true"
                            className="bg-primary mt-1.5 size-1 shrink-0 rounded-full"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <span className="text-primary mt-5 inline-flex items-center gap-1 text-sm font-medium">
                      <MousePointerClick className="size-4" />
                      Open live preview
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed">
            These are design directions, not downloadable themes. Each is
            adapted to your content and built as part of a paid engagement.
          </p>
        </div>
      </Section>

      <Section className="border-border bg-secondary/35 border-y" spacing="sm">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Every template ships with the same foundation
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              The visual direction changes. The engineering standard does not.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Layers,
                title: "Responsive, accessible markup",
                description:
                  "Semantic structure, keyboard support, reduced-motion handling, and layouts tested from phone to wide desktop.",
              },
              {
                icon: Sparkles,
                title: "Technical SEO and GEO",
                description:
                  "Clean metadata, canonical URLs, structured data, sitemap, and AI-crawler-friendly content from launch.",
              },
              {
                icon: ArrowRight,
                title: "Launch and handover",
                description:
                  "Deployment, analytics, repository access, documentation, and a 30-day defect-fix window.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]"
              >
                <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                  <item.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Start from a direction, not a blank page
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            Launch projects begin at $500 with a written fixed quote. Tell us
            which template caught your eye and what you need it to do.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/contact" data-track="templates-contact">
                Start a project
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
      </Section>
    </>
  );
}

function TemplateThumbnail({
  accent,
  accentSoft,
  surface,
  bg,
  ink,
  border,
}: {
  accent: string;
  accentSoft: string;
  surface: string;
  bg: string;
  ink: string;
  border: string;
}) {
  return (
    <div
      className="relative aspect-[4/3] overflow-hidden p-5"
      style={{ background: bg }}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-xl p-4"
        style={{ background: surface, border: `1px solid ${border}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="size-4 rounded" style={{ background: accent }} />
            <span
              className="h-1.5 w-12 rounded-full"
              style={{ background: ink, opacity: 0.75 }}
            />
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-1 w-4 rounded-full"
                style={{ background: border }}
              />
            ))}
          </div>
        </div>
        <div className="mt-8 max-w-[80%]">
          <div
            className="h-2.5 w-16 rounded-full"
            style={{ background: accentSoft }}
          />
          <div
            className="mt-3 h-3.5 w-full rounded-full"
            style={{ background: ink, opacity: 0.85 }}
          />
          <div
            className="mt-2 h-3.5 w-4/5 rounded-full"
            style={{ background: ink, opacity: 0.85 }}
          />
          <div
            className="mt-3 h-1.5 w-full rounded-full"
            style={{ background: border }}
          />
          <div
            className="mt-1.5 h-1.5 w-3/4 rounded-full"
            style={{ background: border }}
          />
          <div
            className="mt-5 h-6 w-24 rounded-full"
            style={{ background: accent }}
          />
        </div>
        <div className="mt-7 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-10 rounded-lg"
              style={{ background: index === 0 ? accentSoft : bg }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
