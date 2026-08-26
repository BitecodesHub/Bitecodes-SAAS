import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  Bot,
  ClipboardList,
  CalendarClock,
  NotebookPen,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  title: "Pricing — Development Rates & SaaS Credit Packs",
  description:
    "Transparent starting-from rates for custom software development, plus prepaid credit packs for our AI chatbot, forms, booking and email products.",
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

/**
 * The products, listed here because this is the page people open when they
 * want to know what things cost. Forms and Booking were sellable and
 * unmentioned on it, so a visitor comparing prices saw project work and the
 * chatbot and concluded that was everything. Notes is free rather than
 * metered, but a price page that hides a free product undersells it.
 */
const PRODUCTS = [
  {
    href: "/ai-chatbot",
    icon: Bot,
    title: "AI Chatbot",
    body: "An assistant that answers from your own content, embedded with one line of code. Prepaid tokens; a refusal costs almost nothing.",
    cta: "See chatbot pricing",
  },
  {
    href: "/forms",
    icon: ClipboardList,
    title: "Forms",
    body: "A form on any website, with submissions emailed to you and stored with CSV export. One credit per submission, and spam never bills you.",
    cta: "See form pricing",
  },
  {
    href: "/booking",
    icon: CalendarClock,
    title: "Booking",
    body: "A calendar people can book directly, correct in every timezone and impossible to double-book. One credit per confirmed booking.",
    cta: "See booking pricing",
  },
  {
    href: "/notes",
    icon: NotebookPen,
    title: "Notes",
    body: "A private, local-first AI assistant on your desktop. Free download for Windows and macOS during early access.",
    cta: "Download free",
  },
];

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
        description="Transparent starting-from pricing for an India-based outsourced software studio. Every engagement is scoped to your needs — these are floors, not fixed quotes. All prices are shown in USD, INR, AUD, and GBP."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Pricing", href: "/pricing" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page">
          <div className="border-primary/20 bg-primary/5 flex flex-col gap-5 rounded-3xl border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-start gap-4">
              <span className="bg-primary text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-2xl">
                <Calculator className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">
                  Plan a realistic project budget
                </h2>
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
                  Configure your product, capabilities, platforms, delivery
                  speed, and support to get an instant INR estimate and
                  timeline.
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link href="/project-cost-calculator">
                Calculate project cost
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            Ready-made products, priced per use
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Three things you can put on your own website today. Each is prepaid
            and metered, so there is no monthly fee and nothing to cancel — you
            buy credits and spend them as they are used.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PRODUCTS.map((product) => (
              <Link
                key={product.href}
                href={product.href}
                className="border-border bg-card hover:border-primary/40 group rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-colors"
              >
                <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
                  <product.icon className="size-4.5" />
                </span>
                <h3 className="mt-4 font-semibold">{product.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {product.body}
                </p>
                <p className="text-primary mt-4 inline-flex items-center gap-1.5 text-sm font-medium">
                  {product.cta}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </Section>

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
            Prices are indicative starting points in USD, INR, AUD, and GBP
            using build-time exchange rates (re-pinned quarterly). Final quotes
            are fixed after a short discovery conversation. Bitecodes works on a
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
