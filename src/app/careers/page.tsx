import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section, SectionHeader } from "@/components/section";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import {
  benefits,
  cultureValues,
  hiringProcess,
  jobOpenings,
} from "@/data/careers";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Careers",
  description:
    "Join Bitecodes — a remote-first software studio that values ownership, craft, and continuous learning. See our open roles and how we hire.",
  path: "/careers",
});

export default function CareersPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Careers", path: "/careers" },
        ])}
      />
      <PageHeader
        eyebrow="Careers"
        title="Do the best work of your career"
        description="We're a small, senior, remote-first team that cares deeply about craft. If that sounds like you, we'd love to talk."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Careers", href: "/careers" },
        ]}
      />

      {/* Culture */}
      <Section>
        <div className="container-page">
          <SectionHeader eyebrow="Culture" title="How we work together" />
          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {cultureValues.map((v) => (
              <StaggerItem key={v.title}>
                <div className="border-border bg-card h-full rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                  <h3 className="font-semibold">{v.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {v.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </Section>

      {/* Benefits */}
      <Section className="border-border bg-card/40 border-y">
        <div className="container-page">
          <SectionHeader eyebrow="Benefits" title="What we offer" />
          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <StaggerItem key={b.title}>
                <div className="border-border bg-card flex h-full gap-4 rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                  <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                    <b.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{b.title}</h3>
                    <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </Section>

      {/* Open positions */}
      <Section>
        <div className="container-page">
          <SectionHeader eyebrow="Open roles" title="Where you fit in" />
          <div className="mx-auto mt-12 max-w-3xl space-y-4">
            {jobOpenings.map((job, i) => (
              <Reveal key={job.slug} delay={i * 0.05}>
                <div className="group border-border bg-card hover:border-primary/30 flex flex-col gap-4 rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-colors sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{job.title}</h3>
                      <Badge variant="muted">{job.department}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {job.summary}
                    </p>
                    <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" />
                        {job.location}
                      </span>
                      <span>{job.type}</span>
                    </div>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    className="shrink-0 sm:self-center"
                  >
                    <Link
                      href={`/contact?role=${job.slug}`}
                      aria-label={`Apply for ${job.title}`}
                    >
                      Apply
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* Hiring process */}
      <Section className="border-border border-t">
        <div className="container-page">
          <SectionHeader eyebrow="Hiring" title="Our process is simple" />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {hiringProcess.map((step, i) => (
              <Reveal key={step.step} delay={i * 0.05}>
                <div className="border-border bg-card h-full rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                  <span className="text-gradient text-3xl font-semibold">
                    0{step.step}
                  </span>
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <CtaSection
        title="Don't see your role?"
        description={`We're always glad to meet talented people. Reach out at ${siteConfig.contact.email}.`}
      />
    </>
  );
}
