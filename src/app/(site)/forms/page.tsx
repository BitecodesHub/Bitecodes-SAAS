import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Code2,
  Download,
  Globe,
  Mail,
  Palette,
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
import { createMetadata, breadcrumbSchema, faqSchema } from "@/lib/seo";
import {
  CREDIT_PACKS,
  formatPackPrice,
  perSubmissionPrice,
} from "@/lib/server/billing/packs";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Form Builder for Any Website — Embed, Collect, Pay Per Submission",
  description:
    "Bitecodes Forms lets you build a form, embed it on any website with one line of code, and collect submissions to your inbox and dashboard. Domain-locked, spam-filtered, CSV export, and prepaid submission credits with no monthly lock-in.",
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
    icon: Sparkles,
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
          offers: CREDIT_PACKS.map((pack) => ({
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
            Put a working form on any site,{" "}
            <span className="text-gradient">in one line of code.</span>
          </>
        }
        description="Build the form here, lock it to your domains, and paste one line into your website. Submissions arrive in your inbox and dashboard. You pay per submission — no monthly fee."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Forms", href: "/forms" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page flex flex-wrap gap-3">
          <Button asChild variant="gradient" size="lg">
            <Link href="/contact">
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="glass" size="lg">
            <Link href="#pricing">See pricing</Link>
          </Button>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.05}>
                <div className="border-border bg-card h-full rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                  <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                    <step.icon className="size-5" />
                  </span>
                  <p className="text-muted-foreground mt-4 text-xs font-medium tracking-wider uppercase">
                    Step {i + 1}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            The embed code
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Both snippets are generated for you in the dashboard, with your form
            id and token already filled in.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="border-border bg-muted/30 overflow-x-auto rounded-2xl border p-4">
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                Script tag — inline form
              </p>
              <pre className="text-foreground/90 text-xs leading-relaxed">
                <code>{`<script src="${siteConfig.url}/form-widget.js"
  data-form="YOUR_FORM_ID"
  data-token="YOUR_PUBLIC_TOKEN">
</script>`}</code>
              </pre>
            </div>
            <div className="border-border bg-muted/30 overflow-x-auto rounded-2xl border p-4">
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                Iframe — no JavaScript on your page
              </p>
              <pre className="text-foreground/90 text-xs leading-relaxed">
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
          <h2 className="text-2xl font-semibold tracking-tight">
            What you get
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.05}>
                <div className="border-border bg-card h-full rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                  <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                    <feature.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {feature.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-3.5" />
                </span>
                <span className="text-muted-foreground text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section spacing="sm" id="pricing">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            Submission credits
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            One credit per accepted submission. Spam caught by the honeypot is
            free, credits do not expire while your account is open, and there is
            no monthly commitment.{" "}
            <span className="text-foreground font-medium">
              Launch pricing — introductory rates while the product is new.
            </span>
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.packId}
                className="border-border bg-card relative flex flex-col rounded-2xl border p-6 shadow-[var(--shadow-soft)]"
              >
                {pack.popular && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-3 right-5"
                  >
                    Most chosen
                  </Badge>
                )}
                <h3 className="text-lg font-semibold">{pack.label}</h3>
                <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                  {formatPackPrice(pack)}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {pack.credits.toLocaleString()} submissions ·{" "}
                  {perSubmissionPrice(pack)} each
                </p>
                <p className="text-muted-foreground mt-3 flex-1 text-sm leading-relaxed">
                  {pack.blurb}
                </p>
                <Button
                  asChild
                  variant={pack.popular ? "gradient" : "outline"}
                  className="mt-5 w-full"
                >
                  <Link href="/contact">Get started</Link>
                </Button>
              </div>
            ))}
          </div>

          <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
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
          <h2 className="text-2xl font-semibold tracking-tight">
            Frequently asked
          </h2>
          <dl className="mt-6 max-w-3xl space-y-5">
            {FAQS.map((item) => (
              <div key={item.question}>
                <dt className="font-medium">{item.question}</dt>
                <dd className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <CtaSection />
    </>
  );
}
