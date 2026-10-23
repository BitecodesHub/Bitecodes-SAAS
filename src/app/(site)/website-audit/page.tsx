import type { Metadata } from "next";
import { Activity, Eye, LockKeyhole } from "lucide-react";
import { WebsiteAuditTool } from "@/components/audit/website-audit-tool";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { breadcrumbSchema, createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Free Website Audit — SEO, Performance & Security",
  description:
    "Run a free passive website audit for SEO, initial response performance, accessibility markup, HTTPS, and defensive security headers. No sign-up required.",
  path: "/website-audit",
});

export default function WebsiteAuditPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          { name: "Website audit", path: "/website-audit" },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Bitecodes Website Audit",
          description:
            "Passive audit of one public webpage for SEO, response performance, accessibility markup, HTTPS, and defensive headers.",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        }}
      />
      <PageHeader
        eyebrow="Free website audit"
        title={
          <>
            Find what is holding your website <span>back.</span>
          </>
        }
        description="Check one public webpage for practical SEO, response performance, accessibility, HTTPS, and defensive-header improvements—without an account or invasive scan."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Tools", href: "/tools" },
          { name: "Website audit", href: "/website-audit" },
        ]}
      />
      <Section spacing="sm">
        <div className="container-page grid gap-3 sm:grid-cols-3">
          <Principle
            icon={Eye}
            title="Passive by design"
            description="Reads one public HTML response and its headers."
          />
          <Principle
            icon={LockKeyhole}
            title="Private networks blocked"
            description="Local, reserved, metadata, and non-standard destinations are rejected."
          />
          <Principle
            icon={Activity}
            title="Bounded and respectful"
            description="Strict redirects, timeout, response size, and hourly limits."
          />
        </div>
      </Section>
      <Section className="bg-surface-2" spacing="sm">
        <div className="container-page">
          <WebsiteAuditTool />
        </div>
      </Section>
      <Section spacing="sm">
        <div className="container-page max-w-3xl text-center">
          <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.025em] sm:text-[32px]">
            What this audit does not claim
          </h2>
          <p className="text-muted-foreground mt-4 text-[17px] leading-[1.65]">
            This is a lead-friendly first-pass review, not a penetration test,
            full crawler, browser-based Lighthouse run, legal compliance
            certification, or guarantee that a website is secure or accessible.
            Those require deeper evidence, authorization, tooling, and expert
            review.
          </p>
        </div>
      </Section>
    </>
  );
}

function Principle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Eye;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-surface-2 flex gap-4 rounded-[24px] p-6">
      <span className="bg-background text-primary flex size-11 shrink-0 items-center justify-center rounded-[14px]">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        <p className="text-muted-foreground mt-1.5 text-[14px] leading-[1.55]">
          {description}
        </p>
      </div>
    </div>
  );
}
