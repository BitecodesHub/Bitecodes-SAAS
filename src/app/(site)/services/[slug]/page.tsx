import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { ServiceCard } from "@/components/cards/service-card";
import { TechIcon } from "@/components/tech-icon";
import { Button } from "@/components/ui/button";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { services, getService } from "@/data/services";
import { getTech } from "@/data/technologies";
import { createMetadata, breadcrumbSchema, serviceSchema } from "@/lib/seo";
import { ServicePricing } from "@/components/pricing/service-pricing";

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return createMetadata({ title: "Service not found" });
  return createMetadata({
    title: service.title,
    description: service.description,
    path: `/services/${service.slug}`,
  });
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const related = services
    .filter((s) => s.category === service.category && s.slug !== service.slug)
    .slice(0, 3);
  const stack = service.stack.map(getTech).filter(Boolean);

  return (
    <>
      <JsonLd data={serviceSchema(service)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
          { name: service.title, path: `/services/${service.slug}` },
        ])}
      />
      <PageHeader
        eyebrow={service.category}
        title={service.title}
        description={service.tagline}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Services", href: "/services" },
          { name: service.title, href: `/services/${service.slug}` },
        ]}
      />

      <Section>
        <div className="container-page grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          <Reveal className="space-y-6">
            <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
              <service.icon className="size-7" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight">
              The overview
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {service.description}
            </p>
            <h3 className="pt-4 text-lg font-semibold">What’s included</h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {service.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal direction="left" className="space-y-6">
            <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
              <h3 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                Typical stack
              </h3>
              <div className="mt-4 flex flex-col gap-3">
                {stack.map(
                  (tech) =>
                    tech && (
                      <div key={tech.slug} className="flex items-center gap-3">
                        <TechIcon slug={tech.slug} name={tech.name} size="sm" />
                        <span className="text-sm font-medium">{tech.name}</span>
                      </div>
                    ),
                )}
              </div>
            </div>
            <ServicePricing slug={service.slug} />
            <div className="border-border from-brand-1 via-brand-2 to-brand-3 rounded-2xl border bg-gradient-to-br p-6 text-white">
              <h3 className="text-lg font-semibold">Ready to start?</h3>
              <p className="mt-2 text-sm text-white/85">
                Book a short call and we’ll scope it together.
              </p>
              <Button
                asChild
                className="text-foreground mt-4 bg-white hover:bg-white/90"
              >
                <Link href="/contact">
                  Get in touch
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </Section>

      {related.length > 0 && (
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <h2 className="text-xl font-semibold tracking-tight">
              Related services
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => (
                <ServiceCard key={s.slug} service={s} className="h-full" />
              ))}
            </div>
          </div>
        </Section>
      )}

      <CtaSection />
    </>
  );
}
