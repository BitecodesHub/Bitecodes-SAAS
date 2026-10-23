import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { ServiceCard } from "@/components/cards/service-card";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { services } from "@/data/services";

export function ServicesSection() {
  const featured = services.slice(0, 6);

  return (
    <Section id="services" className="bg-surface-2">
      <div className="container-page">
        <SectionHeader
          eyebrow="What we do"
          title="A full-stack studio for every stage of software."
          description="From a first marketing site to enterprise platforms and applied AI, we cover the entire lifecycle — design, build, ship, and maintain."
        />

        <StaggerGroup className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((service) => (
            <StaggerItem key={service.slug}>
              <ServiceCard service={service} className="h-full" />
            </StaggerItem>
          ))}
        </StaggerGroup>

        <div className="mt-10 flex justify-center">
          <Link
            href="/services"
            className="text-primary inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium transition-opacity hover:opacity-75"
          >
            Explore all {services.length} services
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </Section>
  );
}
