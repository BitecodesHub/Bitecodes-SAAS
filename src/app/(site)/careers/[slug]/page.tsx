import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarDays,
  Check,
  Clock,
  House,
  MapPin,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section, SectionHeader } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { formatStipend, getJobOpening, jobOpenings } from "@/data/careers";
import {
  breadcrumbSchema,
  createMetadata,
  faqSchema,
  jobPostingSchema,
} from "@/lib/seo";
import { siteConfig } from "@/lib/site";

// Only the roles in src/data/careers.ts exist; anything else is a 404 rather
// than an on-demand render, which keeps this route fully static.
export const dynamicParams = false;

export function generateStaticParams() {
  return jobOpenings.map((j) => ({ slug: j.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = getJobOpening(slug);
  // `image: false`: this segment has its own opengraph-image.tsx.
  if (!job) return createMetadata({ title: "Role not found", image: false });
  return {
    ...createMetadata({
      title: job.seoTitle,
      description: job.seoDescription,
      path: `/careers/${job.slug}`,
      image: false,
    }),
    keywords: [
      "internship in Ahmedabad",
      "internship in Gandhinagar",
      "sales internship Ahmedabad",
      "marketing internship Ahmedabad",
      "business development internship Ahmedabad",
      "work from home internship Ahmedabad",
      "work from home internship Gandhinagar",
      "paid internship Ahmedabad",
      "BBA internship Ahmedabad",
      "MBA marketing internship Gandhinagar",
      "internship for freshers Ahmedabad",
    ],
  };
}

export default async function JobOpeningPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = getJobOpening(slug);
  if (!job) notFound();

  const applyHref = `/contact?role=${job.slug}`;
  const cities = job.cities.join(" & ");
  const lastDate = new Date(
    `${job.validThrough}T00:00:00+05:30`,
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const facts = [
    {
      icon: BadgeIndianRupee,
      label: "Stipend",
      value: `${formatStipend(job.stipend)} + incentives`,
    },
    { icon: House, label: "Work mode", value: "Work from home" },
    { icon: MapPin, label: "Open to", value: `Candidates in ${cities}` },
    {
      icon: CalendarDays,
      label: "Duration",
      value: `${job.duration}, start immediately`,
    },
    { icon: Clock, label: "Hours", value: job.hours },
    {
      icon: Users,
      label: "Openings",
      value: `${job.openings} · apply by ${lastDate}`,
    },
  ];

  const lists = [
    { title: "What you will do", items: job.responsibilities },
    { title: "What we look for", items: job.requirements },
    { title: "Who can apply", items: job.whoCanApply },
    { title: "Perks", items: job.perks },
  ];

  return (
    <>
      <JsonLd data={jobPostingSchema(job)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Careers", path: "/careers" },
          { name: job.title, path: `/careers/${job.slug}` },
        ])}
      />
      <JsonLd data={faqSchema(job.faqs)} />

      <PageHeader
        eyebrow={`Internship · Work from home · ${cities}`}
        title={job.title}
        description={job.summary}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Careers", href: "/careers" },
          {
            name: "Sales & Marketing Internship",
            href: `/careers/${job.slug}`,
          },
        ]}
      />

      {/* Key facts — every value mirrors the JobPosting markup above. */}
      <Section className="pt-0">
        <div className="container-page">
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((f) => (
              <Reveal key={f.label}>
                <div className="border-border bg-card flex h-full gap-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
                  <f.icon className="text-primary mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                      {f.label}
                    </p>
                    <p className="mt-1 text-sm font-medium">{f.value}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link
                href={applyHref}
                aria-label={`Apply for the ${job.title} internship`}
              >
                Apply now
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href={siteConfig.contact.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ask on WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </Section>

      <Section className="bg-surface-2">
        <div className="container-page">
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {lists.map((l) => (
              <Reveal key={l.title}>
                <div className="border-border bg-card h-full rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                  <h2 className="text-lg font-semibold">{l.title}</h2>
                  <ul className="mt-4 space-y-3">
                    {l.items.map((item) => (
                      <li
                        key={item}
                        className="text-muted-foreground flex gap-2.5 text-sm leading-relaxed"
                      >
                        <Check className="text-primary mt-0.5 size-4 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mx-auto mt-6 max-w-4xl">
            <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
              <h2 className="text-lg font-semibold">Skills you will build</h2>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {job.skills.join(" · ")}
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section>
        <div className="container-page">
          <SectionHeader
            eyebrow="About Bitecodes"
            title="A small software studio from Ahmedabad"
          />
          <Reveal className="text-muted-foreground mx-auto mt-6 max-w-3xl space-y-4 text-center leading-relaxed">
            <p>
              Bitecodes has built websites, web and enterprise applications,
              SaaS products, APIs and AI automation since {siteConfig.founded},
              for startups and businesses in India, the US, the UK, Australia
              and the Middle East. Most of that work has come through referrals.
            </p>
            <p>
              This internship is how we change that. You will learn how software
              is sold to real clients, from the first cold message to the signed
              proposal, while working from home in {cities}.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* Answers stay rendered in the HTML (not collapsed) so search engines
          and answer engines can read every one. */}
      <Section className="bg-surface-2">
        <div className="container-page">
          <SectionHeader eyebrow="FAQ" title="Internship questions, answered" />
          <div className="mx-auto mt-10 max-w-3xl space-y-4">
            {job.faqs.map((faq) => (
              <Reveal key={faq.question}>
                <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                  <h3 className="font-semibold">{faq.question}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <CtaSection
        title="Ready to start in sales?"
        description={`Apply in two minutes. Questions first? Email ${siteConfig.contact.email}.`}
        primary={{ label: "Apply now", href: applyHref }}
        secondary={{ label: "All careers", href: "/careers" }}
      />
    </>
  );
}
