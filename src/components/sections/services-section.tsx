import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { ServiceCard } from "@/components/cards/service-card";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { services } from "@/data/services";

export function ServicesSection() {
  const featured = services.slice(0, 8);
  return (
    <Section id="services">
      <div className="container-page">
        <SectionHeader
          eyebrow="What we do"
          title="A full-stack studio for every stage of software"
          description="From a first marketing site to enterprise platforms and applied AI, we cover the entire lifecycle — design, build, ship, and maintain."
        />
        <StaggerGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((service) => (
            <StaggerItem key={service.slug}>
              <ServiceCard service={service} className="h-full" />
            </StaggerItem>
          ))}
        </StaggerGroup>
        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/services">
              View all {services.length} services
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
