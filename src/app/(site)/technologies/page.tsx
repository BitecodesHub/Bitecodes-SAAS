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
    "The languages, frameworks, databases, cloud platforms, and AI tools Bitecodes uses to build fast, reliable software — Java, Spring Boot, Next.js, React, AWS, Azure, and more.",
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
        <div className="container-page space-y-14">
          {techCategories.map((category) => {
            const items = technologies.filter((t) => t.category === category);
            return (
              <div key={category}>
                <div className="mb-6 flex items-center gap-4">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {category}
                  </h2>
                  <span className="bg-border h-px flex-1" />
                </div>
                <StaggerGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((tech) => (
                    <StaggerItem key={tech.slug}>
                      <div className="border-border bg-card hover:border-primary/30 flex h-full gap-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)] transition-colors">
                        <TechIcon slug={tech.slug} name={tech.name} size="md" />
                        <div>
                          <h3 className="font-semibold">{tech.name}</h3>
                          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
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
