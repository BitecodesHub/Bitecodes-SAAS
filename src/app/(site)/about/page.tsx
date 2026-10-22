import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Eye,
  Heart,
  ShieldCheck,
  Target,
  Workflow,
} from "lucide-react";
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
    "The story, mission, and values behind Bitecodes, a remote-first software studio building dependable products for clients worldwide.",
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
    title: "Craft we are proud of",
    description:
      "Every detail matters, because the details are what your users actually feel.",
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

const howWeWork = [
  {
    icon: Workflow,
    title: "Our process",
    description:
      "See the stages a project moves through, what happens at each one, and what you receive.",
    href: "/process",
    cta: "Read the process",
  },
  {
    icon: ShieldCheck,
    title: "Our guarantees",
    description:
      "Read the commitments we are prepared to make, stated plainly with their limits.",
    href: "/guarantees",
    cta: "Read the guarantees",
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
        description={`${siteConfig.name} is a remote-first software studio. We design, build, and maintain dependable software for startups and enterprises at home and around the world.`}
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
                believed a small team of senior engineers could do better.
              </p>
              <p>
                Today we work with organisations in healthcare, education,
                recruitment, media, and technology. The work ranges from
                marketing sites to care-operations automation, learning
                platforms, and AI products.
              </p>
              <p>
                We publish how we work, what we charge, and the commitments we
                are prepared to make. The portfolio also states which work is
                client work, related-party work, or our own internal product.
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
                  pleasure to use, and to make the process feel effortless.
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

      {/* Process and guarantees */}
      <Section>
        <div className="container-page">
          <SectionHeader
            eyebrow="How we work"
            title="Read the commitments before you commit"
            description="The process and the guarantees are public, so you can judge how we work before a conversation."
          />
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
            {howWeWork.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group border-border bg-card focus-visible:ring-ring focus-visible:ring-offset-background hover:bg-accent/40 rounded-2xl border p-7 shadow-[var(--shadow-soft)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                  <item.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {item.description}
                </p>
                <span className="text-primary mt-5 inline-flex items-center gap-2 text-sm font-medium">
                  {item.cta}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Section>

      <FounderSection />
      <CtaSection />
    </>
  );
}
