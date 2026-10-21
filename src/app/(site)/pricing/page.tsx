import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  Check,
  Clock,
  FileCheck2,
  Minus,
  Receipt,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { FaqDetails } from "@/components/faq/faq-details";
import { createMetadata, breadcrumbSchema, faqSchema } from "@/lib/seo";
import { services, serviceCategories } from "@/data/services";
import { guarantees } from "@/data/guarantees";
import { discoverySprint, entryOffers, offerPackages } from "@/data/offers";
import {
  SERVICE_PRICING,
  CURRENCIES,
  FX_RATES,
  FX_RATES_AS_OF,
  formatPrice,
  getPricing,
  unitPhrase,
} from "@/lib/pricing";
import { siteConfig } from "@/lib/site";
import type { Faq } from "@/types/content";

export const metadata: Metadata = createMetadata({
  title: "Pricing — Packages, Rates & Payment Terms",
  description:
    "Transparent software development pricing: three packages with what is included and excluded, milestone payment terms, published service floors in USD, INR, AUD, and GBP, and three ways to start.",
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

const CONSULTING_RATE = getPricing("technical-consulting")!.startingFromUSD;
const RETAINER_FLOOR = getPricing("maintenance-support")!.startingFromUSD;

const FAQS: Faq[] = [
  {
    question: "Are these prices final?",
    answer:
      "No. Every figure on this page is a published floor, not a quote. After a short discovery conversation you receive a written fixed quote that itemises the scope, deliverables, assumptions, and exclusions. Work starts only after you approve that quote in writing.",
  },
  {
    question: "How do payments work?",
    answer:
      "Invoices follow agreed milestones rather than a single upfront payment. Most engagements begin with a deposit of 40 to 50 percent, and the balance is invoiced as each milestone is reviewed and accepted. With two milestones the split is 50/50; with three or more it starts at 40 percent. The exact schedule is written into the quote before work begins, and retainers are billed monthly in advance.",
  },
  {
    question: "What happens when the scope changes?",
    answer: `Every change is written down with its impact on price and timeline before any work starts. You approve or reject it in writing, and approved changes are added to the agreed scope and milestone plan. Additional consulting or change-request work is billed at the published rate of ${formatPrice(CONSULTING_RATE, "USD")} per hour unless the quote says otherwise.`,
  },
  {
    question: "What does the maintenance retainer cover?",
    answer: `The retainer starts at ${formatPrice(RETAINER_FLOOR, "USD")} per month and covers a defined monthly scope agreed in writing: updates, monitoring, and fixes within an agreed support plan. It does not include new features, which are quoted as change requests. Maintenance clients receive a first response within one business day, and critical production or security issues the same business day, Monday to Friday, 10:00 to 18:00 IST.`,
  },
  {
    question: "Which currency will I be invoiced in?",
    answer:
      "The USD figure is canonical. INR, AUD, and GBP are converted with static rates that are shown on this page and re-pinned quarterly. The written quote states the invoicing currency, and that is the amount that applies. Taxes such as GST are additional and are shown separately on the invoice.",
  },
  {
    question: "Can we start smaller than a full project?",
    answer: `Yes. Run the free website audit, book a free strategy call, or buy a one-week Discovery Sprint for ${formatPrice(discoverySprint.priceUSD, "USD")}. If you proceed with a build within 30 days, the sprint fee is credited against the first milestone.`,
  },
  {
    question: "Do you offer a guarantee?",
    answer:
      "Every engagement includes a written fixed quote before work starts, milestone-based payments, code in a repository you own from day one, ownership of the custom code on final payment, a 30-day defect-fix window after launch, and a full handover if you end the engagement at the end of any milestone. The detailed commitments and their limits are on the guarantees page.",
  },
];

function guaranteeTitle(slug: string): string {
  return guarantees.find((guarantee) => guarantee.slug === slug)?.title ?? slug;
}

export default function PricingPage() {
  return (
    <>
      <JsonLd data={pricingCatalogSchema()} />
      <JsonLd data={faqSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
      />
      <PageHeader
        eyebrow="Pricing"
        title="Published floors, clear packages, written quotes"
        description="Every price on this page is public: three packages with what is included and excluded, the floor for each service, and the payment terms we work to. The final figure is fixed in writing after a short discovery conversation."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Pricing", href: "/pricing" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Three ways to start
              </h2>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
                Two cost nothing, and the third is the smallest paid engagement.
                None of them requires you to know the full scope yet.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {entryOffers.map((offer) => (
              <Link
                key={offer.key}
                href={offer.href}
                className="border-border bg-card hover:border-primary/40 group flex flex-col rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-colors"
              >
                <Badge
                  variant={offer.priceLabel === "Free" ? "default" : "outline"}
                >
                  {offer.priceLabel}
                </Badge>
                <h3 className="mt-4 text-lg font-semibold">{offer.title}</h3>
                <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">
                  {offer.summary}
                </p>
                <p className="text-primary mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
                  {offer.cta}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </Section>

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
                  Configure the product, capabilities, platforms, delivery
                  speed, and support to get an instant INR estimate. The
                  calculator never quotes below the published floors on this
                  page.
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

      <Section id="packages">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">Packages</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Each package is a starting point for a scoped engagement, priced at
            the published floor of the services it contains. Inclusions and
            exclusions are listed in full so the written quote has no surprises.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {offerPackages.map((offer) => (
              <article
                key={offer.slug}
                className="border-border bg-card flex flex-col rounded-3xl border p-6 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{offer.name}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Typically {offer.timeline.minWeeks} to{" "}
                      {offer.timeline.maxWeeks} weeks
                    </p>
                  </div>
                  <Clock className="text-muted-foreground size-5 shrink-0" />
                </div>
                <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                  {offer.summary}
                </p>

                <p className="mt-6 text-3xl font-semibold tracking-tight">
                  From {formatPrice(offer.priceUSD, "USD")}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {CURRENCIES.filter((currency) => currency.code !== "USD")
                    .map(
                      (currency) =>
                        `${formatPrice(offer.priceUSD, currency.code)} ${currency.code}`,
                    )
                    .join(" · ")}
                </p>

                <div className="border-border mt-6 border-t pt-5">
                  <p className="text-xs font-semibold tracking-wider uppercase">
                    Included
                  </p>
                  <ul className="mt-3 space-y-2.5 text-sm">
                    {offer.includes.map((line) => (
                      <li key={line} className="flex gap-2.5">
                        <Check className="text-primary mt-0.5 size-4 shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-border mt-5 border-t pt-5">
                  <p className="text-xs font-semibold tracking-wider uppercase">
                    Not included
                  </p>
                  <ul className="text-muted-foreground mt-3 space-y-2.5 text-sm">
                    {offer.excludes.map((line) => (
                      <li key={line} className="flex gap-2.5">
                        <Minus className="mt-0.5 size-4 shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-6">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={offer.cta.href}>{offer.cta.label}</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <div className="border-border bg-card mt-6 grid gap-6 rounded-3xl border p-6 shadow-[var(--shadow-soft)] lg:grid-cols-[1fr_1.2fr] lg:p-8">
            <div>
              <Badge variant="secondary">Paid discovery</Badge>
              <h3 className="mt-3 text-xl font-semibold">
                {discoverySprint.name} —{" "}
                {formatPrice(discoverySprint.priceUSD, "USD")}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {discoverySprint.summary}
              </p>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {discoverySprint.creditNote}
              </p>
              <Button asChild className="mt-5">
                <Link href="/book-a-call">
                  Book a call to start
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <ul className="space-y-2.5 text-sm">
              {discoverySprint.includes.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <Check className="text-primary mt-0.5 size-4 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-border bg-muted/30 mt-6 rounded-2xl border p-5">
            <p className="text-sm font-medium">
              Every package includes these commitments
            </p>
            <ul className="text-muted-foreground mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {[
                "written-fixed-quote",
                "milestone-payments",
                "client-owns-code",
                "code-in-your-repository",
                "defect-fix-window",
                "no-lock-in",
              ].map((slug) => (
                <li key={slug} className="flex gap-2">
                  <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
                  <Link
                    href="/guarantees"
                    className="hover:text-foreground underline-offset-4 hover:underline"
                  >
                    {guaranteeTitle(slug)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">How we bill</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            The same terms apply to every engagement, and they are written into
            the quote before work begins.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <BillingCard
              icon={FileCheck2}
              title="Milestones, not a lump sum"
              body="Invoices follow agreed milestones. Most projects begin with a deposit of 40 to 50 percent, and the balance is invoiced as each milestone is reviewed and accepted. The exact split is in the written quote."
            />
            <BillingCard
              icon={Receipt}
              title="Change requests are priced first"
              body={`Every change is documented with its effect on price and timeline. You approve it in writing before work starts. Additional consulting is billed at the published rate of ${formatPrice(CONSULTING_RATE, "USD")} per hour unless the quote says otherwise.`}
            />
            <BillingCard
              icon={Clock}
              title="Retainers are monthly, in advance"
              body={`Maintenance starts at ${formatPrice(RETAINER_FLOOR, "USD")} per month and covers a defined scope agreed in writing. New features are quoted separately. Support hours are Monday to Friday, 10:00 to 18:00 IST, with a first response within one business day.`}
            />
            <BillingCard
              icon={Sparkles}
              title="Currency and tax"
              body={`The USD figure is canonical. INR, AUD, and GBP use static rates last reviewed on ${FX_RATES_AS_OF}. The quote states the invoicing currency. GST and other applicable taxes are additional and itemised on the invoice.`}
            />
          </div>

          <div className="border-border bg-card mt-6 flex flex-col gap-3 rounded-2xl border p-5 text-sm shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Static FX rates: 1 USD = {FX_RATES.INR} INR = {FX_RATES.AUD} AUD ={" "}
              {FX_RATES.GBP} GBP. Last reviewed {FX_RATES_AS_OF}. The written
              quote is the amount that applies.
            </p>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/guarantees">
                Read the guarantees
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section>
        <div className="container-page space-y-16">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Every service and its floor
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              All 19 services, in four currencies. These are starting points for
              a scoped engagement; the written quote is the fixed price.
            </p>
          </div>

          {serviceCategories.map((category) => {
            const items = SERVICE_PRICING.filter((p) => {
              const svc = services.find((s) => s.slug === p.slug);
              return svc?.category === category;
            });
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <div className="mb-6 flex items-center gap-4">
                  <h3 className="text-xl font-semibold tracking-tight">
                    {category}
                  </h3>
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
                            <h4 className="font-semibold tracking-tight">
                              <Link
                                href={`/services/${p.slug}`}
                                className="hover:text-primary"
                              >
                                {svc.title}
                              </Link>
                            </h4>
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
                            {unitPhrase(p.unit)} · fixed quote after discovery
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
            Prices are indicative starting points, converted from the canonical
            USD floor with static rates re-pinned quarterly. Final quotes are
            fixed after a short discovery conversation. Bitecodes works on a
            fixed-scope or dedicated-capacity basis.
          </p>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            Pricing questions
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            The answers below are the same commitments that appear in the
            written quote.
          </p>
          <div className="mt-8">
            <FaqDetails faqs={FAQS} defaultOpenFirst={false} />
          </div>
        </div>
      </Section>

      <CtaSection
        title="Have a project in mind?"
        description="Tell us what you are building and we will come back with a scoped estimate, usually within a day."
      />
    </>
  );
}

function BillingCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
      <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
        <Icon className="size-4" />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {body}
      </p>
    </div>
  );
}
