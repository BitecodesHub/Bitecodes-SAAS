import type { Metadata } from "next";
import { Compass, Eye, Heart, Target } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section, SectionHeader } from "@/components/section";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { FounderSection } from "@/components/sections/founder-section";
import { StatsSection } from "@/components/sections/stats-section";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { createMetadata, breadcrumbSchema, personSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "About",
  description:
    "The story, mission, and values behind Bitecodes — a remote-first software studio building dependable products for clients worldwide.",
  path: "/about",
});

const values = [
  {
    icon: Target,
    title: "Outcomes over output",
    description:
      "We measure success by the problem solved, not the hours logged or the lines written.",
  },
  {
    icon: Heart,
    title: "Craft we're proud of",
    description:
      "Every detail matters — because the details are what your users actually feel.",
  },
  {
    icon: Compass,
    title: "Honest by default",
    description:
      "Clear estimates, straight answers, and no surprises. Trust is the whole business.",
  },
  {
    icon: Eye,
    title: "Long-term thinking",
    description:
      "We build software that ages well, because we plan to be around to maintain it.",
  },
];

const journey = [
  {
    year: "2021",
    title: "Bitecodes begins",
    description:
      "Founded to bring senior-level engineering to teams that wanted a partner, not a vendor.",
  },
  {
    year: "2022",
    title: "First enterprise platforms",
    description:
      "Delivered operations and management systems built on Java, Spring Boot, and React.",
  },
  {
    year: "2023",
    title: "Going international",
    description:
      "Began partnering with clients across borders, including aged-care operators in Australia.",
  },
  {
    year: "2024",
    title: "Product & platform work",
    description:
      "Shipped learning platforms, media portfolios, and recruitment products end to end.",
  },
  {
    year: "2025",
    title: "Applied AI & MCP",
    description:
      "Launched AI-driven products like PRISM and built MCP servers connecting systems to AI.",
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={personSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ])}
      />
      <PageHeader
        eyebrow="About us"
        title="A studio built on craft and accountability"
        description={`${siteConfig.name} is a remote-first software studio. We design, build, and maintain dependable software for startups and enterprises — at home and around the world.`}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "About", href: "/about" },
        ]}
      />

      {/* Story */}
      <Section>
        <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Our story
            </h2>
            <div className="text-muted-foreground mt-4 space-y-4 leading-relaxed">
              <p>
                Bitecodes started with a simple frustration: too much software
                is shipped slow, bloated, and impossible to maintain. We
                believed small teams of senior engineers could do better — and
                our clients agreed.
              </p>
              <p>
                Today we work as an embedded partner to companies across
                healthcare, education, recruitment, media, and technology,
                delivering everything from marketing sites to enterprise
                platforms and applied AI.
              </p>
              <p>
                We stay deliberately lean and senior-heavy. That means fewer
                hand-offs, clearer communication, and software we are genuinely
                proud to put our name on.
              </p>
            </div>
          </Reveal>
          <Reveal direction="left">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                  <Target className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">Our mission</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  To build software that is fast, reliable, and a genuine
                  pleasure to use — and to make the process feel effortless.
                </p>
              </div>
              <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)] sm:mt-8">
                <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                  <Eye className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">Our vision</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  A world where great engineering is accessible to every
                  ambitious team, regardless of size or location.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      <StatsSection />

      {/* Values */}
      <Section className="border-border bg-card/40 border-y">
        <div className="container-page">
          <SectionHeader
            eyebrow="Values"
            title="The principles behind every decision"
          />
          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <StaggerItem key={v.title}>
                <div className="border-border bg-card h-full rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                  <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                    <v.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{v.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {v.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </Section>

      {/* Journey */}
      <Section>
        <div className="container-page">
          <SectionHeader eyebrow="Journey" title="How we got here" />
          <div className="mx-auto mt-12 max-w-3xl">
            {journey.map((item, i) => (
              <Reveal key={item.year} delay={i * 0.05}>
                <div className="flex gap-6 pb-8 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="border-border bg-card text-primary flex size-12 shrink-0 items-center justify-center rounded-full border text-sm font-semibold shadow-[var(--shadow-soft)]">
                      {item.year}
                    </span>
                    {i < journey.length - 1 && (
                      <span className="bg-border mt-2 w-px flex-1" />
                    )}
                  </div>
                  <div className="pt-2.5 pb-2">
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <FounderSection />
      <CtaSection />
    </>
  );
}
