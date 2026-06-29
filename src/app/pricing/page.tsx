import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";
import { services, serviceCategories } from "@/data/services";
import {
  SERVICE_PRICING,
  formatPrice,
  unitPhrase,
  CURRENCIES,
} from "@/lib/pricing";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Pricing — Software Development Rates (USD, INR, AUD)",
  description:
    "Transparent starting-from pricing for Bitecodes software development services — websites, web apps, SaaS, APIs, AI, cloud, and DevOps. View rates in USD, INR, and AUD.",
  path: "/pricing",
});

/** OfferCatalog JSON-LD enumerating every service as a priced USD offer. */
function pricingCatalogSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Bitecodes Software Development Services",
    url: `${siteConfig.url}/pricing`,
    inLanguage: "en",
    provider: { "@id": `${siteConfig.url}/#organization` },
    itemListElement: SERVICE_PRICING.map((p) => {
      const svc = services.find((s) => s.slug === p.slug)!;
      return {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: svc.title,
          url: `${siteConfig.url}/services/${p.slug}`,
        },
        price: String(p.startingFromUSD),
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${siteConfig.url}/services/${p.slug}`,
      };
    }),
  };
}

export default function PricingPage() {
  return (
    <>
      <JsonLd data={pricingCatalogSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
      />
      <PageHeader
        eyebrow="Pricing"
        title="Software development pricing"
        description="Transparent starting-from pricing for an India-based outsourced software studio. Every engagement is scoped to your needs — these are floors, not fixed quotes. All prices are shown in USD, INR, and AUD."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Pricing", href: "/pricing" },
        ]}
      />

      <Section>
        <div className="container-page space-y-16">
          {serviceCategories.map((category) => {
            const items = SERVICE_PRICING.filter((p) => {
              const svc = services.find((s) => s.slug === p.slug);
              return svc?.category === category;
            });
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <div className="mb-6 flex items-center gap-4">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {category}
                  </h2>
                  <span className="bg-border h-px flex-1" />
                  <span className="text-muted-foreground text-sm">
                    {items.length} services
                  </span>
                </div>
                <Reveal>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((p) => {
                      const svc = services.find((s) => s.slug === p.slug)!;
                      return (
                        <div
                          key={p.slug}
                          className="border-border bg-card flex flex-col rounded-2xl border p-6 shadow-[var(--shadow-soft)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-semibold tracking-tight">
                              <Link
                                href={`/services/${p.slug}`}
                                className="hover:text-primary"
                              >
                                {svc.title}
                              </Link>
                            </h3>
                            <Badge variant="secondary">{p.model}</Badge>
                          </div>

                          <dl className="mt-5 space-y-2">
                            {CURRENCIES.map((c) => (
                              <div
                                key={c.code}
                                className="flex items-baseline justify-between gap-3"
                              >
                                <dt className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                                  {c.code}
                                </dt>
                                <dd
                                  className={
                                    c.code === "USD"
                                      ? "text-lg font-bold tracking-tight"
                                      : "text-muted-foreground text-sm font-medium"
                                  }
                                >
                                  from {formatPrice(p.startingFromUSD, c.code)}
                                </dd>
                              </div>
                            ))}
                          </dl>

                          <p className="text-muted-foreground mt-4 text-xs">
                            {unitPhrase(p.unit)} · scoped to your project
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Reveal>
              </div>
            );
          })}

          <p className="text-muted-foreground mx-auto max-w-2xl text-center text-sm leading-relaxed">
            Prices are indicative starting points in USD, INR, and AUD using
            build-time exchange rates (re-pinned quarterly). Final quotes are
            fixed after a short discovery conversation. Bitecodes works on a
            fixed-scope or dedicated-capacity basis.
          </p>
        </div>
      </Section>

      <CtaSection
        title="Have a project in mind?"
        description="Tell us what you are building and we'll come back with a scoped estimate — usually within a day."
      />
    </>
  );
}
