import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { TechIcon } from "@/components/tech-icon";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { technologies, techCategories } from "@/data/technologies";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Technologies",
  description:
    "The languages, frameworks, databases, and cloud platforms Bitecodes uses to build fast, reliable software — Java, Spring Boot, Next.js, React, AWS, and more.",
  path: "/technologies",
});

export default function TechnologiesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Technologies", path: "/technologies" },
        ])}
      />
      <PageHeader
        eyebrow="Technologies"
        title="A stack chosen for reliability and speed"
        description="We favor mature, well-understood tools — and adopt the right new ones deliberately. Here is what we reach for, and why."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Technologies", href: "/technologies" },
        ]}
      />
      <Section>
        <div className="container-page space-y-20">
          {techCategories.map((category) => {
            const items = technologies.filter((t) => t.category === category);
            return (
              <div key={category}>
                <div className="mb-8 flex items-baseline justify-between gap-6">
                  <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
                    {category}
                  </h2>
                  <span className="text-muted-foreground text-[13px] tabular-nums">
                    {items.length} {items.length === 1 ? "tool" : "tools"}
                  </span>
                </div>
                <StaggerGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((tech) => (
                    <StaggerItem key={tech.slug}>
                      <div className="bg-surface-2 hover:bg-background flex h-full items-start gap-4 rounded-[24px] p-6 transition-colors duration-300 hover:shadow-[var(--shadow-soft)]">
                        <TechIcon slug={tech.slug} name={tech.name} size="md" />
                        <div className="min-w-0">
                          <h3 className="text-[17px] leading-tight font-semibold tracking-[-0.01em]">
                            {tech.name}
                          </h3>
                          <p className="text-muted-foreground mt-2 text-[15px] leading-[1.5]">
                            {tech.description}
                          </p>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerGroup>
              </div>
            );
          })}
        </div>
      </Section>
      <CtaSection
        title="Have a stack in mind?"
        description="Whether you're committed to a technology or open to advice, we'll help you make the right call."
      />
    </>
  );
}
