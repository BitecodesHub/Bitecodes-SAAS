import { Section, SectionHeader } from "@/components/section";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { industries } from "@/data/industries";

export function IndustriesSection() {
  return (
    <Section className="border-border bg-muted/50 border-y">
      <div className="container-page">
        <SectionHeader
          eyebrow="Industries"
          title="Domain knowledge that shortens the learning curve"
          description="We have shipped software across these sectors — so we speak your language from day one."
        />
        <StaggerGroup className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((industry) => (
            <StaggerItem key={industry.slug}>
              <div className="group border-border bg-card hover:border-primary/30 flex h-full gap-4 rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-colors">
                <span className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors">
                  <industry.icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold">{industry.name}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                    {industry.description}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </Section>
  );
}
