import type { Metadata } from "next";
import { Bot, LockKeyhole, Scale } from "lucide-react";
import { ProjectConsultant } from "@/components/ai/project-consultant";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { breadcrumbSchema, createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "AI Project Consultant & Software Quote Planner",
  description:
    "Describe your software idea and get an AI-assisted scope, technology direction, cost range, timeline, and discovery questions in return.",
  path: "/ai-project-consultant",
});

export default function AiProjectConsultantPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools" },
          { name: "AI Project Consultant", path: "/ai-project-consultant" },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Bitecodes AI Project Consultant",
          description:
            "AI-assisted software service, scope, technology, cost, timeline, and team recommendation.",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        }}
      />
      <PageHeader
        eyebrow="AI project consultant"
        title={
          <>
            Turn a rough idea into a <span>credible project direction.</span>
          </>
        }
        description="Get an AI-assisted recommendation grounded in Bitecodes services and published pricing—then bring it to a human for discovery and a final proposal."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Tools", href: "/tools" },
          { name: "AI Project Consultant", href: "/ai-project-consultant" },
        ]}
      />
      <Section spacing="sm">
        <div className="container-page grid gap-4 sm:grid-cols-3">
          <Principle
            icon={Bot}
            title="Business-grounded"
            description="Uses Bitecodes services, capabilities, technologies, and pricing context."
          />
          <Principle
            icon={Scale}
            title="Directional, not contractual"
            description="Ranges and assumptions require human validation before a final quote."
          />
          <Principle
            icon={LockKeyhole}
            title="Privacy-conscious"
            description="No account required; provider routing requests zero data retention."
          />
        </div>
      </Section>
      <Section className="border-border bg-secondary/35 border-y" spacing="sm">
        <div className="container-page">
          <ProjectConsultant />
        </div>
      </Section>
      <Section spacing="sm">
        <div className="container-page max-w-3xl text-center">
          <h2 className="text-2xl font-semibold">
            An assistant for discovery—not an autonomous salesperson
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            The consultant cannot issue a contract, promise outcomes, verify
            compliance, or replace technical discovery. It produces a structured
            first recommendation from the information you provide. Bitecodes
            reviews scope, risks, dependencies, and commercial terms before
            making a final proposal.
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
  icon: typeof Bot;
  title: string;
  description: string;
}) {
  return (
    <div className="border-border bg-card flex gap-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
      <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
