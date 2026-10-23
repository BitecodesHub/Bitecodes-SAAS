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
  formatStipend,
  jobOpenings,
} from "@/data/careers";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  ...createMetadata({
    title: "Careers: Work-from-Home Sales Internship, Ahmedabad & Gandhinagar",
    description:
      "Bitecodes is hiring sales and marketing interns in Ahmedabad and Gandhinagar. Work from home, ₹2,000–5,000/month plus incentives, certificate and a full-time offer.",
    path: "/careers",
  }),
  keywords: [
    "internship in Ahmedabad",
    "internship in Gandhinagar",
    "work from home internship Ahmedabad",
    "sales internship Ahmedabad",
    "marketing internship Gandhinagar",
    "Bitecodes careers",
  ],
};

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
        eyebrow="Careers · Now hiring interns"
        title="Learn sales on real software deals"
        description="We are hiring sales and marketing interns in Ahmedabad and Gandhinagar. Work from home, ₹2,000–5,000 a month plus incentives, and you work directly with the founder."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Careers", href: "/careers" },
        ]}
      />

      {/* Culture */}
      <Section>
        <div className="container-page">
          <SectionHeader
            eyebrow="How we work"
            title="What the internship is like"
          />
          <StaggerGroup className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cultureValues.map((v) => (
              <StaggerItem key={v.title}>
                <div className="bg-surface-2 h-full rounded-[24px] p-7">
                  <h3 className="text-[19px] font-semibold tracking-[-0.01em]">
                    {v.title}
                  </h3>
                  <p className="text-muted-foreground mt-2.5 text-[15px] leading-[1.55]">
                    {v.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </Section>

      {/* Benefits */}
      <Section className="bg-surface-2">
        <div className="container-page">
          <SectionHeader
            eyebrow="What you get"
            title="Stipend, incentives and more"
          />
          <StaggerGroup className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <StaggerItem key={b.title}>
                <div className="bg-background flex h-full gap-4 rounded-[24px] p-7">
                  <span className="bg-surface-2 text-primary flex size-11 shrink-0 items-center justify-center rounded-[14px]">
                    <b.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-[19px] font-semibold tracking-[-0.01em]">
                      {b.title}
                    </h3>
                    <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
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
          <SectionHeader eyebrow="Open roles" title="Now hiring" />
          <div className="mx-auto mt-14 max-w-3xl space-y-3">
            {jobOpenings.map((job, i) => (
              <Reveal key={job.slug} delay={i * 0.05}>
                <div className="group bg-surface-2 flex flex-col gap-5 rounded-[24px] p-7 transition-all duration-300 hover:shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-[21px] font-semibold tracking-[-0.015em]">
                        <Link
                          href={`/careers/${job.slug}`}
                          className="hover:text-primary inline-flex min-h-11 items-center transition-colors"
                        >
                          {job.title}
                        </Link>
                      </h3>
                      <Badge variant="muted">{job.department}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
                      {job.summary}
                    </p>
                    <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-4 text-[13px]">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" />
                        {job.location}
                      </span>
                      <span>{job.type}</span>
                      <span>{formatStipend(job.stipend)} + incentives</span>
                    </div>
                  </div>
                  <Button
                    asChild
                    variant="secondary"
                    className="bg-background shrink-0 sm:self-center"
                  >
                    <Link
                      href={`/careers/${job.slug}`}
                      aria-label={`View and apply for ${job.title}`}
                    >
                      View & apply
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
      <Section className="bg-surface-2">
        <div className="container-page">
          <SectionHeader eyebrow="Hiring" title="Four steps, about a week" />
          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hiringProcess.map((step, i) => (
              <Reveal key={step.step} delay={i * 0.05}>
                <div className="bg-background h-full rounded-[24px] p-7">
                  <span className="text-muted-foreground text-[13px] font-semibold tabular-nums">
                    0{step.step}
                  </span>
                  <h3 className="mt-3 text-[19px] font-semibold tracking-[-0.01em]">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <CtaSection
        title="Questions about the internship?"
        description={`Email ${siteConfig.contact.email} or message us on WhatsApp. We reply within two working days.`}
        primary={{
          label: "View the internship",
          href: `/careers/${jobOpenings[0]?.slug ?? ""}`,
        }}
        secondary={{ label: "Contact us", href: "/contact" }}
      />
    </>
  );
}
