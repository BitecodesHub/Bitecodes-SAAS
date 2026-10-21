import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  ClipboardList,
  Code2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { JsonLd } from "@/components/json-ld";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoSnippet } from "@/components/demo/demo-snippet";
import { breadcrumbSchema, createMetadata, faqSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Demos",
  description:
    "See Bitecodes Booking, Forms, and AI Chatbot with your own content. A 20-minute walkthrough, real embed code, and free credits to try the products yourself.",
  path: "/demo",
});

const PRODUCTS = [
  {
    id: "booking",
    icon: CalendarClock,
    name: "Booking",
    headline: "A calendar that cannot be double-booked",
    description:
      "Publish the hours you actually work and let people book a time in their own timezone. Each confirmed booking uses one prepaid credit.",
    href: "/booking",
    bullets: [
      "Weekly hours, minimum notice, booking horizon, and blackout dates",
      "Timezone-correct for the visitor, with the zone stated on screen",
      "A database rule settles two people clicking the same slot at once",
      "Domain allowlist, so the calendar only runs where you approve",
    ],
    snippetLabel: "Booking — script embed",
    snippet: `<script src="${siteConfig.url}/booking-widget.js"
  data-booking="YOUR_BOOKING_ID"
  data-token="YOUR_PUBLIC_TOKEN">
</script>`,
    alternative: `Or use the hosted page: ${siteConfig.url}/book/YOUR_BOOKING_ID`,
  },
  {
    id: "forms",
    icon: ClipboardList,
    name: "Forms",
    headline: "A form that lands in your inbox, not in spam",
    description:
      "Build the fields you need, lock the form to your domains, and collect submissions in a dashboard you can search and export. One accepted submission uses one credit.",
    href: "/forms",
    bullets: [
      "Text, email, phone, dropdown, checkbox, and long-text fields",
      "Honeypot spam filtering that never charges a credit",
      "Email notifications, searchable submissions, and CSV export",
      "Script tag for an inline form, or an iframe with no JavaScript",
    ],
    snippetLabel: "Forms — script embed",
    snippet: `<script src="${siteConfig.url}/form-widget.js"
  data-form="YOUR_FORM_ID"
  data-token="YOUR_PUBLIC_TOKEN">
</script>`,
    alternative: `Or use the hosted page: ${siteConfig.url}/form/YOUR_FORM_ID`,
  },
  {
    id: "chatbot",
    icon: Bot,
    name: "AI Chatbot",
    headline: "An assistant that answers from your material",
    description:
      "Load the pages, documents, and questions you already trust, then embed an assistant that answers from them and hands over when it should.",
    href: "/ai-chatbot",
    bullets: [
      "Answers grounded in content you approve, not open-ended invention",
      "A defined fallback and a route to a human when confidence is low",
      "Token usage and cost visible before the bill arrives",
      "Domain allowlist and a public token that can be rotated",
    ],
    snippetLabel: "Chatbot — script embed",
    snippet: `<script src="${siteConfig.url}/widget.js"
  data-chatbot="YOUR_CHATBOT_ID"
  data-token="YOUR_PUBLIC_TOKEN">
</script>`,
    alternative: `Or use the hosted page: ${siteConfig.url}/chat/YOUR_CHATBOT_ID`,
  },
];

const WALKTHROUGH = [
  {
    icon: Users,
    title: "Bring a real use case",
    body: "A page you want to improve, a form you already use, or a question your team answers every day. We configure the product around that, not around a scripted example.",
  },
  {
    icon: Code2,
    title: "See the embed, not a slide",
    body: "You watch the configuration happen, then see the calendar, form, or assistant render on a page you recognise. The embed code is yours to take away.",
  },
  {
    icon: ShieldCheck,
    title: "Leave with the limits",
    body: "Pricing, credit use, domain locking, data handling, and what the product does not do. A walkthrough that only lists strengths is a sales call, not a demo.",
  },
];

const FAQS = [
  {
    question: "Is this a recorded demo or a live product?",
    answer:
      "The walkthrough is live and uses your content. There is no pre-recorded video and no scripted demo tenant. If you prefer to evaluate alone, create a free account and the products are usable with free credits.",
  },
  {
    question: "Why is there no shared public sandbox on this page?",
    answer:
      "Each product is locked to the domains its owner approves. A shared sandbox would either weaken that rule or mix every visitor into the same data. A real configuration created with your content is both safer and more useful.",
  },
  {
    question: "Do I need a developer for the walkthrough?",
    answer:
      "No. The person who owns the website, the booking process, or the inbox is the right person. If a developer usually installs scripts, bring them; the embed is one line, but the conversation about domains and data is easier with them present.",
  },
  {
    question: "How long does it take, and what does it cost?",
    answer:
      "Twenty minutes, at no cost. You leave with a working configuration, the embed code, and a clear price. There is no obligation to buy credits to attend.",
  },
];

export default function DemoPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Demos", path: "/demo" },
        ])}
      />
      <JsonLd data={faqSchema(FAQS)} />

      <PageHeader
        eyebrow="Demos"
        title="See the products with your own content"
        description="Booking, Forms, and AI Chatbot are real products you can try today. A twenty-minute walkthrough configures one of them around your website, your forms, or the questions your team answers most."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Demos", href: "/demo" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page">
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/book-a-call" data-track="demo-book-call">
                Book a 20-minute live demo
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/signup" data-track="demo-start-free">
                Start free instead
              </Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {WALKTHROUGH.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.05}>
                <div className="border-border bg-card h-full rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                  <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                    <item.icon className="size-5" />
                  </span>
                  <h2 className="mt-4 font-semibold">{item.title}</h2>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section spacing="sm" className="border-border border-t">
        <div className="container-page space-y-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Three products, one account
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              Each product works on its own and shares the same dashboard and
              prepaid credits. The snippets below are the real embed formats;
              the dashboard fills in your ids and tokens.
            </p>
          </div>

          {PRODUCTS.map((product) => (
            <article
              key={product.id}
              id={product.id}
              className="border-border bg-card scroll-mt-24 rounded-2xl border p-6 shadow-[var(--shadow-soft)] sm:p-8"
            >
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                      <product.icon className="size-5" />
                    </span>
                    <Badge variant="secondary">{product.name}</Badge>
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-balance">
                    {product.headline}
                  </h3>
                  <p className="text-muted-foreground mt-3 leading-relaxed">
                    {product.description}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {product.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-3 text-sm leading-relaxed"
                      >
                        <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                          <Check className="size-3.5" />
                        </span>
                        <span className="text-muted-foreground">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={product.href}
                      className="text-primary inline-flex min-h-11 items-center gap-1.5 text-sm font-medium hover:underline"
                      data-track={`demo-product-${product.id}`}
                    >
                      Read about {product.name}
                      <ArrowRight className="size-4" />
                    </Link>
                    <Link
                      href="/signup"
                      className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
                      data-track={`demo-signup-${product.id}`}
                    >
                      Try it free
                    </Link>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <DemoSnippet
                    label={product.snippetLabel}
                    code={product.snippet}
                  />
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {product.alternative}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section spacing="sm" className="border-border border-t">
        <div className="container-page grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              A note on what this page is not
            </h2>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              There is no fake dashboard, invented customer quote, or scripted
              chat window here. The products are locked to approved domains, so
              a meaningful preview needs a real configuration and a page you
              own.
            </p>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              If you would rather not speak to anyone yet, create a free account
              and use the free credits. The walkthrough exists for the questions
              that documentation cannot answer.
            </p>
          </div>
          <div className="divide-border border-border divide-y rounded-2xl border">
            {FAQS.map((faq) => (
              <div key={faq.question} className="p-5">
                <h3 className="text-sm font-semibold">{faq.question}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section spacing="sm" className="border-border border-t">
        <div className="container-page flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Bring your own website, form, or question.
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Twenty minutes is usually enough to know whether a product fits.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/book-a-call" data-track="demo-footer-book-call">
                Book a walkthrough
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact" data-track="demo-footer-contact">
                Ask a question
              </Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
