import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Layers, MousePointerClick, Sparkles } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { CtaSection } from "@/components/cta-section";
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
                  className="group bg-background flex h-full flex-col overflow-hidden rounded-[28px] shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
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
                  <div className="flex flex-1 flex-col p-7">
                    <p className="text-muted-foreground text-[13px] font-semibold tracking-[0.12em] uppercase">
                      {template.industry}
                    </p>
                    <h2 className="group-hover:text-primary mt-2 text-[24px] font-semibold tracking-[-0.02em] transition-colors">
                      {template.name}
                    </h2>
                    <p className="text-muted-foreground mt-2.5 text-[15px] leading-[1.55]">
                      {template.tagline}
                    </p>
                    <ul className="mt-5 space-y-2">
                      {template.bestFor.slice(0, 2).map((item) => (
                        <li
                          key={item}
                          className="text-muted-foreground flex items-start gap-2.5 text-[14px] leading-[1.5]"
                        >
                          <span
                            aria-hidden="true"
                            className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <span className="text-primary mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium">
                      <MousePointerClick className="size-4" />
                      Open live preview
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          <p className="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-[13px] leading-[1.6]">
            These are design directions, not downloadable themes. Each is
            adapted to your content and built as part of a paid engagement.
          </p>
        </div>
      </Section>

      <Section className="bg-surface-2" spacing="sm">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.025em] sm:text-[40px]">
              Every template ships with the same foundation
            </h2>
            <p className="text-muted-foreground mt-4 text-[17px] leading-[1.6]">
              The visual direction changes. The engineering standard does not.
            </p>
          </div>
          <div className="mt-12 grid gap-3 md:grid-cols-3">
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
                className="bg-background rounded-[24px] p-7"
              >
                <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-[14px]">
                  <item.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.01em]">
                  {item.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <CtaSection
        title="Start from a direction, not a blank page."
        description="Launch projects begin at $500 with a written fixed quote. Tell us which template caught your eye and what you need it to do."
        primary={{
          label: "Start a project",
          href: "/contact",
          track: "templates-contact",
        }}
        secondary={{
          label: "Estimate the cost",
          href: "/website-development-cost-calculator",
          track: "templates-calculator",
        }}
      />
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
