import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section } from "@/components/section";
import { ServiceCard } from "@/components/cards/service-card";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { services } from "@/data/services";

export function ServicesSection() {
  const featured = services.slice(0, 6);

  return (
    <Section id="services">
      <div className="container-page">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Reveal className="max-w-2xl">
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
              What we do
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl md:leading-[1.08]">
              A full-stack studio for every stage of software.
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
              From a first marketing site to enterprise platforms and applied
              AI, we cover the entire lifecycle — design, build, ship, and
              maintain.
            </p>
          </Reveal>
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/services">
              All {services.length} services
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <StaggerGroup className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((service) => (
            <StaggerItem key={service.slug}>
              <ServiceCard service={service} className="h-full" />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </Section>
  );
}
