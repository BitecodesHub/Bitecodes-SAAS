import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Code2,
  Download,
  Globe,
  Layers,
  Mail,
  Palette,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { createMetadata, breadcrumbSchema, faqSchema } from "@/lib/seo";
import {
  formatPackPrice,
  packsFor,
  perSubmissionPrice,
} from "@/lib/server/billing/packs";

// Only this product's packs. `CREDIT_PACKS` holds every product's, so iterating
// it here would advertise chatbot token packs on the forms page.
const FORM_PACKS = packsFor("forms");
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Embeddable Form Builder — Free Credits, No Card",
  description:
    "Build a form and embed it on any website with one line of code. Submissions land in your inbox and dashboard. Spam-filtered, CSV export, free credits to start.",
  path: "/forms",
});

const STEPS = [
  {
    icon: ClipboardList,
    title: "Build the form",
    body: "Add the fields you need — text, email, phone, dropdown, checkbox, long text. Reorder them, mark what is required, done.",
  },
  {
    icon: Globe,
    title: "Lock it to your domains",
    body: "List the sites allowed to use it, wildcards included. Anywhere else is refused, so nobody can point your form at their own page.",
  },
  {
    icon: Code2,
    title: "Paste one line",
    body: "Copy the script tag or the iframe and drop it into your site. No build step, no framework, no npm install.",
  },
  {
    icon: Mail,
    title: "Collect submissions",
    body: "Every entry is emailed to you and stored in your dashboard, ready to search and export as CSV.",
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Spam filtered, free of charge",
    body: "A hidden honeypot field catches bots and silently discards them. Caught spam never reaches your inbox and never costs a credit.",
  },
  {
    icon: Palette,
    title: "Matches your site",
    body: "Set the accent colour and button text; the form renders inside a shadow root so your CSS and ours can never fight.",
  },
  {
    icon: Download,
    title: "Your data, exportable",
    body: "Submissions are yours. Export to CSV whenever you like, safely escaped so spreadsheets cannot execute what a visitor typed.",
  },
  {
    icon: Layers,
    title: "Two ways to embed",
    body: "A script tag for an inline form, or an iframe for zero JavaScript on your page. Same form, same submissions.",
  },
];

const INCLUDED = [
  "Unlimited forms on one account",
  "Domain allowlist with wildcard support",
  "Email notifications to as many addresses as you need",
  "Honeypot spam filtering that never bills you",
  "Submission dashboard with search and CSV export",
  "REST API for pulling submissions into your own tools",
  "Credits never expire while your account is open",
];

const FAQS = [
  {
    question: "How is Bitecodes Forms priced?",
    answer:
      "You buy prepaid submission credits. One accepted submission costs one credit, there is no monthly fee, and credits do not expire while your account is open. Spam caught by the honeypot costs nothing.",
  },
  {
    question: "What happens when I run out of credits?",
    answer:
      "New submissions are politely declined with a short 'temporarily unavailable' message, and you are emailed straight away so you can top up. We do not silently discard entries, and we do not store submissions you have not paid for.",
  },
  {
    question: "Do I need to write any code?",
    answer:
      "No. You copy one line — either a script tag or an iframe — and paste it into your website's HTML. It works on WordPress, Shopify, Webflow, a static site, or a custom app.",
  },
  {
    question: "Can someone else use my form on their website?",
    answer:
      "No. Each form is locked to the domains you list, and the server refuses submissions from anywhere else. You can rotate the form's public token at any time, which instantly invalidates old embeds.",
  },
  {
    question: "Where are submissions stored, and can I get them out?",
    answer:
      "They are stored in your Bitecodes dashboard and emailed to the addresses you nominate. You can export everything to CSV at any time, or read submissions through the REST API with an API key.",
  },
  {
    question: "Does it work with a form I have already designed?",
    answer:
      "Yes, via the REST API or by pointing your own markup at the submit endpoint. The hosted widget is the fastest route, but it is not the only one.",
  },
];

export default function FormsProductPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Forms", path: "/forms" },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: `${siteConfig.name} Forms`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          description:
            "Embeddable form builder with domain locking, spam filtering, email notifications, CSV export, and prepaid per-submission pricing.",
          url: `${siteConfig.url}/forms`,
          provider: {
            "@type": "Organization",
            "@id": `${siteConfig.url}/#organization`,
            name: siteConfig.name,
          },
          offers: FORM_PACKS.map((pack) => ({
            "@type": "Offer",
            name: `${pack.label} — ${pack.credits.toLocaleString()} submissions`,
            price: String(pack.amount / 100),
            priceCurrency: pack.currency,
            url: `${siteConfig.url}/forms`,
          })),
        }}
      />
      <JsonLd data={faqSchema(FAQS)} />

      <PageHeader
        eyebrow="Forms"
        title={
          <>
            Put a working form on any site, <span>in one line of code.</span>
          </>
        }
        description="Build the form here, lock it to your domains, and paste one line into your website. Submissions arrive in your inbox and dashboard. You pay per submission — no monthly fee."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Forms", href: "/forms" },
        ]}
      >
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">
              Get started free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="#pricing">See pricing</Link>
          </Button>
        </div>
      </PageHeader>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
            How it works
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.05}>
                <div className="bg-surface-2 h-full rounded-[24px] p-7">
                  <span className="bg-background text-primary flex size-11 items-center justify-center rounded-[14px]">
                    <step.icon className="size-5" />
                  </span>
                  <p className="text-muted-foreground mt-5 text-[11px] font-semibold tracking-[0.14em] uppercase">
                    Step {i + 1}
                  </p>
                  <h3 className="mt-1.5 text-[19px] font-semibold tracking-[-0.01em]">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section spacing="sm" className="bg-surface-2">
        <div className="container-page">
          <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
            The embed code
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-[16px] leading-[1.6]">
            Both snippets are generated for you in the dashboard, with your form
            id and token already filled in.
          </p>
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            <div className="bg-background overflow-x-auto rounded-[20px] p-5">
              <p className="text-muted-foreground mb-3 text-[13px] font-medium">
                Script tag — inline form
              </p>
              <pre className="text-foreground/90 text-[13px] leading-[1.6]">
                <code>{`<script src="${siteConfig.url}/form-widget.js"
  data-form="YOUR_FORM_ID"
  data-token="YOUR_PUBLIC_TOKEN">
</script>`}</code>
              </pre>
            </div>
            <div className="bg-background overflow-x-auto rounded-[20px] p-5">
              <p className="text-muted-foreground mb-3 text-[13px] font-medium">
                Iframe — no JavaScript on your page
              </p>
              <pre className="text-foreground/90 text-[13px] leading-[1.6]">
                <code>{`<iframe
  src="${siteConfig.url}/form/YOUR_FORM_ID?t=YOUR_TOKEN"
  style="width:100%;max-width:560px;height:620px;border:0"
  title="Contact form"></iframe>`}</code>
              </pre>
            </div>
          </div>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
            What you get
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.05}>
                <div className="bg-surface-2 h-full rounded-[24px] p-7">
                  <span className="bg-background text-primary flex size-11 items-center justify-center rounded-[14px]">
                    <feature.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.01em]">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
                    {feature.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <ul className="bg-surface-2 mt-3 grid gap-3 rounded-[24px] p-7 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-3.5" />
                </span>
                <span className="text-muted-foreground text-[15px] leading-[1.5]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section spacing="sm" className="bg-surface-2" id="pricing">
        <div className="container-page">
          <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
            Submission credits
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-[16px] leading-[1.6]">
            One credit per accepted submission. Spam caught by the honeypot is
            free, credits do not expire while your account is open, and there is
            no monthly commitment.{" "}
            <span className="text-foreground font-medium">
              Launch pricing — introductory rates while the product is new.
            </span>
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {FORM_PACKS.map((pack) => (
              <div
                key={pack.packId}
                className="bg-background relative flex flex-col rounded-[28px] p-7"
              >
                {pack.popular && (
                  <Badge
                    variant="secondary"
                    className="bg-surface-2 absolute top-5 right-5"
                  >
                    Most chosen
                  </Badge>
                )}
                <h3 className="text-[17px] font-semibold">{pack.label}</h3>
                <p className="mt-3 text-[36px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                  {formatPackPrice(pack)}
                </p>
                <p className="text-muted-foreground mt-2 text-[13px]">
                  {pack.credits.toLocaleString()} submissions ·{" "}
                  {perSubmissionPrice(pack)} each
                </p>
                <p className="text-muted-foreground mt-3 flex-1 text-[15px] leading-[1.55]">
                  {pack.blurb}
                </p>
                <Button
                  asChild
                  variant={pack.popular ? "default" : "secondary"}
                  className={`mt-6 w-full ${pack.popular ? "" : "bg-background"}`}
                >
                  <Link href="/signup">Get started free</Link>
                </Button>
              </div>
            ))}
          </div>

          <p className="text-muted-foreground mt-5 text-[13px] leading-[1.6]">
            Prices in INR and inclusive of applicable taxes at checkout. Need a
            larger volume, an annual arrangement, or self-hosting?{" "}
            <Link
              href="/contact"
              className="text-primary underline-offset-2 hover:underline"
            >
              Talk to us
            </Link>
            .
          </p>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
            Frequently asked
          </h2>
          <dl className="mt-8 max-w-3xl space-y-6">
            {FAQS.map((item) => (
              <div key={item.question}>
                <dt className="text-[16px] font-semibold">{item.question}</dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-[1.65]">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <CtaSection
        title="Collect your first submission today."
        description="Build the form, lock it to your domains, and paste one line into your site. Free credits included — no card required."
        primary={{ label: "Create your account", href: "/signup" }}
        secondary={{ label: "Talk to us first", href: "/contact" }}
      />
    </>
  );
}
