import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Braces,
  Check,
  Code2,
  Gauge,
  Globe,
  MessagesSquare,
  Palette,
  PenLine,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import {
  formatPackPrice,
  packsFor,
  perUnitPrice,
} from "@/lib/server/billing/packs";
import { createMetadata, breadcrumbSchema, faqSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "AI Chatbot for Any Website — Free Credits, No Card",
  description:
    "Train an AI chatbot on your content and embed it on any website with one line of code. RAG knowledge base, multiple AI models, and free credits to start.",
  path: "/ai-chatbot",
});

const STEPS = [
  {
    icon: Bot,
    title: "Create a chatbot",
    body: "Name it, pick a theme, set a welcome message. One account can run many bots.",
  },
  {
    icon: Upload,
    title: "Add your knowledge",
    body: "Upload PDFs, docs, or a spreadsheet — or paste a URL and we crawl the site. It is chunked, embedded, and indexed automatically.",
  },
  {
    icon: PenLine,
    title: "Write the system prompt",
    body: "Shape its tone and rules with a template and variables like {{company_name}}. Version history lets you restore any earlier prompt.",
  },
  {
    icon: Code2,
    title: "Embed one line of code",
    body: "Copy the snippet or iframe, paste it into your site, and the assistant is live immediately — answering from your content.",
  },
];

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "RAG that cites your content",
    body: "Retrieval-augmented answers grounded in your knowledge base, with optional citations and an honest fallback when it does not know.",
  },
  {
    icon: Braces,
    title: "Multiple AI models",
    body: "Choose from the models we enable — GPT, Claude, Gemini, and more — each with its own context window and cost, controlled per plan.",
  },
  {
    icon: Palette,
    title: "Fully customisable widget",
    body: "Colours, logo, avatar, position, size, dark and light mode, typing animation, suggested questions — as a floating bubble, popup, or embedded.",
  },
  {
    icon: Globe,
    title: "Domain protection",
    body: "Whitelist the domains a bot may run on, wildcards included. Every request is re-checked server-side; unauthorised sites are refused.",
  },
  {
    icon: Gauge,
    title: "Usage & analytics",
    body: "Chats, token usage, response time, popular questions, geography and devices — with daily, monthly, and yearly charts.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & multi-tenant",
    body: "Hashed API keys, per-tenant token budgets, rate limiting, audit logs, and a token ledger that caps spend by design.",
  },
];

/**
 * The packs a customer can actually buy, read from the billing source of truth.
 *
 * This page previously advertised four monthly subscription tiers in USD, plus a
 * separate pay-as-you-go strip — none of which existed. There is no subscription
 * machinery, no per-plan chatbot limits, and no webhooks or human hand-off. It
 * promised a billing model and features the product does not have, which is a
 * commercial problem, not a copy problem.
 */
const CHATBOT_PACKS = packsFor("chatbot");

const FAQS = [
  {
    question: "How do I add the AI chatbot to my website?",
    answer:
      "Create a chatbot, add your content, then copy the one-line JavaScript snippet or the iframe embed and paste it into your site. The assistant goes live immediately, with no framework or plugin required.",
  },
  {
    question: "What can I train the chatbot on?",
    answer:
      "Upload PDF, DOCX, TXT, CSV, Markdown, HTML, or JSON files, crawl your website or import a sitemap, or paste content and build FAQs by hand. Everything is chunked, embedded, and searchable with re-index, update, and delete controls.",
  },
  {
    question: "Which AI models are supported?",
    answer:
      "The chatbot is model-agnostic. You choose from the models we enable — such as GPT, Claude, Gemini, DeepSeek, and Qwen — each with its own context window, response limit, and token cost.",
  },
  {
    question: "How does token pricing work?",
    answer:
      "Every answer deducts tokens based on the input and output it uses. Buy token packs as you go or take a monthly plan that includes a token allowance. You always see your remaining balance, and the bot pauses rather than overspending.",
  },
  {
    question: "Is it secure and can I restrict where it runs?",
    answer:
      "Yes. Each chatbot has a domain allowlist (wildcards supported), API keys are hashed and scoped, requests are rate-limited, and a per-tenant token ledger caps spend. Every admin action is audited.",
  },
];

export default function AiChatbotPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "AI Chatbot", path: "/ai-chatbot" },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: `${siteConfig.name} AI Chatbot`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          url: `${siteConfig.url}/ai-chatbot`,
          description:
            "Trainable, embeddable AI chatbot SaaS: RAG knowledge base, multiple AI models, a customisable website widget, analytics, and token-based pricing.",
          // Derived from the packs a customer can actually buy. These offers
          // previously listed four USD subscription tiers that do not exist —
          // structured data is machine-read by search engines and assistants, so
          // a fictional price here is published misinformation, not just stale
          // marketing copy.
          offers: CHATBOT_PACKS.map((pack) => ({
            "@type": "Offer",
            name: `${pack.label} — ${pack.credits.toLocaleString()} tokens`,
            price: (pack.amount / 100).toFixed(2),
            priceCurrency: pack.currency,
          })),
          provider: {
            "@type": "Organization",
            "@id": `${siteConfig.url}/#organization`,
            name: siteConfig.name,
          },
        }}
      />
      <JsonLd data={faqSchema(FAQS)} />

      <PageHeader
        eyebrow="AI Chatbot SaaS"
        title={
          <>
            An AI chatbot for your website,{" "}
            <span>live in one line of code.</span>
          </>
        }
        description="Train it on your content, style it to match your brand, and embed it anywhere. Multiple AI models, a real knowledge base, analytics, and honest token pricing — built and hosted by Bitecodes."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "AI Chatbot", href: "/ai-chatbot" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/contact">
              Start free <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a
              href={siteConfig.contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              Talk to us on WhatsApp
            </a>
          </Button>
        </div>
      </Section>

      {/* How it works */}
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
                  <p className="text-muted-foreground mt-4 text-xs font-medium">
                    Step {i + 1}
                  </p>
                  <h3 className="mt-1 font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* Embed demo */}
      <Section spacing="sm">
        <div className="container-page grid gap-8 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight">
              Two ways to embed
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              A floating widget via a single script tag, or a full-page chat via
              an iframe. Both respect your domain allowlist and go live the
              moment you paste them in.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "No framework, plugin, or build step",
                "Style-isolated so it never clashes with your site",
                "Desktop, tablet, and mobile — dark and light",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal direction="left">
            <div className="border-border bg-card overflow-x-auto rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                Option 1 — JavaScript widget
              </p>
              <pre className="text-foreground/90 text-xs leading-relaxed">
                <code>{`<script src="${siteConfig.url}/widget.js"
  data-chatbot="CHATBOT_ID"
  data-token="PUBLIC_TOKEN">
</script>`}</code>
              </pre>
              <p className="text-muted-foreground mt-5 mb-2 text-xs font-medium">
                Option 2 — iframe
              </p>
              <pre className="text-foreground/90 text-xs leading-relaxed">
                <code>{`<iframe
  src="${siteConfig.url}/chat/CHATBOT_ID"
  width="400" height="600">
</iframe>`}</code>
              </pre>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Features */}
      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            Everything a serious chatbot needs
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.04}>
                <div className="border-border bg-card h-full rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
                  <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                    <f.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* Pricing */}
      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            Simple, token-based pricing
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Buy a pack of tokens once and use them whenever you like — there is
            no subscription and nothing expires monthly. Tokens cover the
            question and the answer together, so a longer reply costs more than
            a short one. Answer counts below are approximate for that reason.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {CHATBOT_PACKS.map((pack) => (
              <div
                key={pack.packId}
                className={
                  pack.popular
                    ? "border-primary bg-card relative flex flex-col rounded-2xl border-2 p-6 shadow-[var(--shadow-lift)]"
                    : "border-border bg-card relative flex flex-col rounded-2xl border p-6 shadow-[var(--shadow-soft)]"
                }
              >
                {pack.popular && (
                  <Badge className="absolute -top-3 left-6">Most chosen</Badge>
                )}
                <h3 className="text-lg font-semibold">{pack.label}</h3>
                <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                  {formatPackPrice(pack)}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {pack.credits.toLocaleString()} tokens · {perUnitPrice(pack)}
                </p>
                <p className="text-muted-foreground mt-3 flex-1 text-sm leading-relaxed">
                  {pack.blurb}
                </p>
                <Button
                  asChild
                  variant={pack.popular ? "default" : "outline"}
                  className="mt-5 w-full"
                >
                  <Link href="/signup">Get started free</Link>
                </Button>
              </div>
            ))}
          </div>

          <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
            Launch pricing, billed in Indian rupees. Every answer is metered
            against your balance and recorded in a ledger you can audit, and the
            assistant stops rather than overspending when a balance runs out.
          </p>
        </div>
      </Section>

      {/* FAQ */}
      <Section spacing="sm">
        <div className="container-page mx-auto max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <dl className="mt-6 space-y-5">
            {FAQS.map((item) => (
              <div
                key={item.question}
                className="border-border border-b pb-5 last:border-0"
              >
                <dt className="font-medium">{item.question}</dt>
                <dd className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <CtaSection
        title="Put an assistant on your site today."
        description="Create your account, train it on your content, and paste one line of code. Free credits included — no card required."
        primary={{ label: "Create your account", href: "/signup" }}
        secondary={{ label: "Talk to us first", href: "/contact" }}
      />
    </>
  );
}
