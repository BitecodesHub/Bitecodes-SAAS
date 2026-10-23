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
          <div className="max-w-2xl">
            <h2 className="text-[clamp(1.875rem,3vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              Three ways to start
            </h2>
            <p className="text-muted-foreground mt-3 text-[17px] leading-relaxed">
              Two cost nothing, and the third is the smallest paid engagement.
              None of them requires you to know the full scope yet.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {entryOffers.map((offer) => (
              <Link
                key={offer.key}
                href={offer.href}
                className="group bg-surface-2 hover:bg-background flex flex-col rounded-[28px] p-7 transition-all duration-300 hover:shadow-[var(--shadow-lift)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[24px] font-semibold tracking-[-0.02em]">
                    {offer.title}
                  </h3>
                  <span className="bg-background text-muted-foreground rounded-full px-3 py-1 text-[13px] font-medium whitespace-nowrap">
                    {offer.priceLabel}
                  </span>
                </div>
                <p className="text-muted-foreground mt-3 flex-1 text-[15px] leading-relaxed">
                  {offer.summary}
                </p>
                <span className="text-primary mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium">
                  {offer.cta}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Section>

      <Section spacing="sm" className="bg-surface-2">
        <div className="container-page">
          <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <span className="bg-background text-primary flex size-14 items-center justify-center rounded-[20px] shadow-[var(--shadow-soft)]">
              <Calculator className="size-6" />
            </span>
            <h2 className="text-[clamp(1.875rem,3.4vw,2.75rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">
              Plan a realistic project budget
            </h2>
            <p className="text-muted-foreground max-w-2xl text-[17px] leading-relaxed">
              Configure the product, capabilities, platforms, delivery speed,
              and support to get an instant INR estimate. The calculator never
              quotes below the published floors on this page.
            </p>
            <Button asChild size="lg">
              <Link href="/project-cost-calculator">
                Calculate project cost
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </Section>

      <Section id="packages">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 className="text-[clamp(1.875rem,3vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              Packages
            </h2>
            <p className="text-muted-foreground mt-3 text-[17px] leading-relaxed">
              Each package is a starting point for a scoped engagement, priced
              at the published floor of the services it contains. Inclusions and
              exclusions are listed in full so the written quote has no
              surprises.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {offerPackages.map((offer) => (
              <article
                key={offer.slug}
                className="bg-surface-2 flex flex-col rounded-[28px] p-7"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[24px] font-semibold tracking-[-0.02em]">
                      {offer.name}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-[13px]">
                      Typically {offer.timeline.minWeeks} to{" "}
                      {offer.timeline.maxWeeks} weeks
                    </p>
                  </div>
                  <Clock
                    className="text-muted-foreground mt-1 size-5 shrink-0"
                    aria-hidden
                  />
                </div>

                <p className="mt-7 text-[40px] leading-none font-semibold tracking-[-0.035em]">
                  From {formatPrice(offer.priceUSD, "USD")}
                </p>
                <p className="text-muted-foreground mt-2 text-[13px]">
                  {CURRENCIES.filter((currency) => currency.code !== "USD")
                    .map(
                      (currency) =>
                        `${formatPrice(offer.priceUSD, currency.code)} ${currency.code}`,
                    )
                    .join(" · ")}
                </p>
                <p className="text-muted-foreground mt-4 text-[15px] leading-relaxed">
                  {offer.summary}
                </p>

                <div className="mt-6">
                  <p className="text-muted-foreground text-[13px] font-medium tracking-[0.06em] uppercase">
                    Included
                  </p>
                  <ul className="mt-3 space-y-2.5 text-[14px] leading-relaxed">
                    {offer.includes.map((line) => (
                      <li key={line} className="flex gap-2.5">
                        <Check className="text-primary mt-0.5 size-4 shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5">
                  <p className="text-muted-foreground text-[13px] font-medium tracking-[0.06em] uppercase">
                    Not included
                  </p>
                  <ul className="text-muted-foreground mt-3 space-y-2.5 text-[14px] leading-relaxed">
                    {offer.excludes.map((line) => (
                      <li key={line} className="flex gap-2.5">
                        <Minus className="mt-0.5 size-4 shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-7">
                  <Button
                    asChild
                    variant="secondary"
                    className="bg-background w-full"
                  >
                    <Link href={offer.cta.href}>{offer.cta.label}</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <div className="bg-surface-2 mt-5 grid gap-8 rounded-[32px] p-8 lg:grid-cols-[1fr_1.1fr] lg:p-12">
            <div>
              <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
                Paid discovery
              </p>
              <h3 className="mt-3 text-[28px] leading-[1.15] font-semibold tracking-[-0.025em]">
                {discoverySprint.name}
                <span className="text-muted-foreground ml-2 text-[20px] font-medium">
                  {formatPrice(discoverySprint.priceUSD, "USD")}
                </span>
              </h3>
              <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
                {discoverySprint.summary}
              </p>
              <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
                {discoverySprint.creditNote}
              </p>
              <Button asChild className="mt-6">
                <Link href="/book-a-call">
                  Book a call to start
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <ul className="space-y-3 text-[15px] leading-relaxed">
              {discoverySprint.includes.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check className="text-primary mt-0.5 size-4 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-surface-2 mt-10 rounded-[24px] p-6 sm:p-7">
            <p className="text-[15px] font-medium">
              Every package includes these commitments
            </p>
            <ul className="mt-4 grid gap-3 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
              {[
                "written-fixed-quote",
                "milestone-payments",
                "client-owns-code",
                "code-in-your-repository",
                "defect-fix-window",
                "no-lock-in",
              ].map((slug) => (
                <li key={slug} className="flex gap-2.5">
                  <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
                  <Link
                    href="/guarantees"
                    className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  >
                    {guaranteeTitle(slug)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section spacing="sm" className="bg-surface-2">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 className="text-[clamp(1.875rem,3vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              How we bill
            </h2>
            <p className="text-muted-foreground mt-3 text-[17px] leading-relaxed">
              The same terms apply to every engagement, and they are written
              into the quote before work begins.
            </p>
          </div>
          <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            <BillingItem
              icon={FileCheck2}
              title="Milestones, not a lump sum"
              body="Invoices follow agreed milestones. Most projects begin with a deposit of 40 to 50 percent, and the balance is invoiced as each milestone is reviewed and accepted. The exact split is in the written quote."
            />
            <BillingItem
              icon={Receipt}
              title="Change requests are priced first"
              body={`Every change is documented with its effect on price and timeline. You approve it in writing before work starts. Additional consulting is billed at the published rate of ${formatPrice(CONSULTING_RATE, "USD")} per hour unless the quote says otherwise.`}
            />
            <BillingItem
              icon={Clock}
              title="Retainers are monthly, in advance"
              body={`Maintenance starts at ${formatPrice(RETAINER_FLOOR, "USD")} per month and covers a defined scope agreed in writing. New features are quoted separately. Support hours are Monday to Friday, 10:00 to 18:00 IST, with a first response within one business day.`}
            />
            <BillingItem
              icon={Sparkles}
              title="Currency and tax"
              body={`The USD figure is canonical. INR, AUD, and GBP use static rates last reviewed on ${FX_RATES_AS_OF}. The quote states the invoicing currency. GST and other applicable taxes are additional and itemised on the invoice.`}
            />
          </div>

          <div className="bg-background mt-10 flex flex-col gap-4 rounded-[20px] p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground max-w-3xl text-[13px] leading-relaxed">
              Static FX rates: 1 USD = {FX_RATES.INR} INR = {FX_RATES.AUD} AUD ={" "}
              {FX_RATES.GBP} GBP. Last reviewed {FX_RATES_AS_OF}. The written
              quote is the amount that applies.
            </p>
            <Button
              asChild
              variant="secondary"
              className="bg-surface-2 shrink-0 self-start"
            >
              <Link href="/guarantees">
                Read the guarantees
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section>
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 className="text-[clamp(1.875rem,3vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              Every service and its floor
            </h2>
            <p className="text-muted-foreground mt-3 text-[17px] leading-relaxed">
              All 19 services, in four currencies. These are starting points for
              a scoped engagement; the written quote is the fixed price.
            </p>
          </div>

          <div className="mt-12 space-y-14">
            {serviceCategories.map((category) => {
              const items = SERVICE_PRICING.filter((p) => {
                const svc = services.find((s) => s.slug === p.slug);
                return svc?.category === category;
              });
              if (items.length === 0) return null;
              return (
                <div
                  key={category}
                  className="bg-surface-2 rounded-[28px] p-6 sm:p-8"
                >
                  <div className="mb-5 flex items-baseline justify-between gap-4">
                    <h3 className="text-[24px] font-semibold tracking-[-0.02em]">
                      {category}
                    </h3>
                    <span className="text-muted-foreground text-[13px]">
                      {items.length} services
                    </span>
                  </div>

                  <div className="border-background text-muted-foreground hidden border-b pb-3 text-[13px] font-medium tracking-[0.06em] uppercase md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_repeat(4,minmax(0,0.7fr))] md:gap-4">
                    <span>Service</span>
                    <span>Model</span>
                    <span>USD</span>
                    <span>INR</span>
                    <span>AUD</span>
                    <span>GBP</span>
                  </div>

                  <ul>
                    {items.map((p) => {
                      const svc = services.find((s) => s.slug === p.slug)!;
                      return (
                        <li
                          key={p.slug}
                          className="border-background flex flex-col gap-1.5 border-b py-4 last:border-0 last:pb-0 md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_repeat(4,minmax(0,0.7fr))] md:items-baseline md:gap-4"
                        >
                          <div className="flex items-baseline justify-between gap-4">
                            <Link
                              href={`/services/${p.slug}`}
                              className="hover:text-primary text-[15px] font-medium underline-offset-4 hover:underline"
                            >
                              {svc.title}
                            </Link>
                            <span className="text-[15px] font-semibold tabular-nums md:hidden">
                              from {formatPrice(p.startingFromUSD, "USD")}
                            </span>
                          </div>
                          <span className="text-muted-foreground text-[13px]">
                            {p.model}
                          </span>
                          {CURRENCIES.map((c) => (
                            <span
                              key={c.code}
                              className={
                                c.code === "USD"
                                  ? "hidden text-[15px] font-semibold tabular-nums md:block"
                                  : "text-muted-foreground hidden text-[14px] tabular-nums md:block"
                              }
                            >
                              {formatPrice(p.startingFromUSD, c.code)}
                            </span>
                          ))}
                          <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[13px] tabular-nums md:hidden">
                            {CURRENCIES.filter((c) => c.code !== "USD").map(
                              (c) => (
                                <span key={c.code}>
                                  {formatPrice(p.startingFromUSD, c.code)}{" "}
                                  {c.code}
                                </span>
                              ),
                            )}
                          </p>
                          <p className="text-muted-foreground/80 text-[13px] md:hidden">
                            {unitPhrase(p.unit)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="text-muted-foreground mx-auto mt-14 max-w-2xl text-center text-[13px] leading-relaxed">
            Prices are indicative starting points, converted from the canonical
            USD floor with static rates re-pinned quarterly. Final quotes are
            fixed after a short discovery conversation. Bitecodes works on a
            fixed-scope or dedicated-capacity basis.
          </p>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 className="text-[clamp(1.875rem,3vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
              Pricing questions
            </h2>
            <p className="text-muted-foreground mt-3 text-[17px] leading-relaxed">
              The answers below are the same commitments that appear in the
              written quote.
            </p>
          </div>
          <div className="mt-10">
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

function BillingItem({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div>
      <span className="bg-background text-primary flex size-10 items-center justify-center rounded-[14px]">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 text-[21px] font-semibold tracking-[-0.02em]">
        {title}
      </h3>
      <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
        {body}
      </p>
    </div>
  );
}
