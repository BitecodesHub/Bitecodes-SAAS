import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Apple,
  Camera,
  Cpu,
  EyeOff,
  Keyboard,
  MessagesSquare,
  Monitor,
  ScanEye,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { NotesDownloads } from "@/components/product/notes-download";
import { createMetadata, breadcrumbSchema, faqSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Notes — Private, Local-First AI Assistant for Your Desktop",
  description:
    "Notes is a private AI assistant that lives in a quiet overlay on your desktop. Capture your screen, ask in plain language, and get streaming answers from a model running on your own machine. Free download for Windows and macOS (Intel and Apple silicon).",
  path: "/notes",
});

const STEPS = [
  {
    icon: Keyboard,
    title: "Summon it",
    body: "One shortcut brings up a translucent window on top of whatever you are working in. It never steals focus, so your cursor stays exactly where it was.",
  },
  {
    icon: Camera,
    title: "Capture the screen",
    body: "Take a screenshot of the thing you are stuck on — an error, a chart, a dense paragraph — and a vision-capable model reads it for you.",
  },
  {
    icon: MessagesSquare,
    title: "Ask in plain language",
    body: "Type a question and watch the answer stream in. Follow up in the same thread; everything is a keystroke away.",
  },
  {
    icon: ShieldCheck,
    title: "It stays yours",
    body: "By default the model runs on your own machine. Nothing is sent anywhere unless you have explicitly switched a remote provider on.",
  },
];

const FEATURES = [
  {
    icon: Cpu,
    title: "Local-first by default",
    body: "Answers come from a model running on your own computer through Ollama. No account, no subscription, and no copy of your screen on someone else's server. Remote endpoints stay blocked until you switch one on, provider by provider.",
  },
  {
    icon: ScanEye,
    title: "Reads your screen",
    body: "Capture any part of the display and ask about it. A stack trace, a spreadsheet, a contract clause — the vision model describes, explains, or summarises what it sees, and you can keep questioning it.",
  },
  {
    icon: EyeOff,
    title: "Out of your way",
    body: "A frameless, translucent, always-on-top window with adjustable opacity. Hide it from the taskbar, keep it in the tray, move it with the keyboard, and dismiss it with the same shortcut that summoned it.",
  },
  {
    icon: Keyboard,
    title: "Keyboard-first",
    body: "Every action has a global shortcut, and every shortcut can be rebound by pressing the keys you want. Conflicts with the OS or other bindings are detected before they bite.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Content protection keeps the window out of screen shares and recordings, so a note to yourself stays a note to yourself. API keys live in OS-encrypted storage, and telemetry is strictly opt-in.",
  },
  {
    icon: Zap,
    title: "Bring your own model",
    body: "Use any Ollama model or any OpenAI-compatible endpoint. Separate slots for fast, thorough, and vision models, with health checks, fallback providers, and live switching — no restart required.",
  },
];

const INCLUDED = [
  "Streaming AI chat in a resizable, translucent overlay",
  "Screenshot capture with vision-model analysis",
  "Works fully offline with local models through Ollama",
  "Any OpenAI-compatible endpoint, with per-provider opt-in",
  "Rebindable global shortcuts with conflict detection",
  "Content protection: excluded from screen shares and recordings",
  "Dark, light, and system themes",
  "Encrypted API-key storage and settings import/export",
];

const FAQS = [
  {
    question: "Is Notes free?",
    answer:
      "Yes. Notes 1.1.0 is a free download for Windows and macOS. It is in early access, so the downloads are behind a password — ask us for one through the contact page or WhatsApp and we will send it over.",
  },
  {
    question: "Does anything leave my machine?",
    answer:
      "Not unless you ask it to. Notes is local-first: out of the box it talks to a model running on your own computer through Ollama, and remote endpoints are blocked until you explicitly enable one per provider. API keys are stored in OS-encrypted storage and left out of settings exports, and telemetry is off unless you opt in.",
  },
  {
    question: "Which AI models does it work with?",
    answer:
      "Any model you can run in Ollama, and any OpenAI-compatible endpoint you configure. Notes keeps separate slots for a fast model, a thorough model, and a vision model, discovers what your provider offers, health-checks it, and falls back to a second provider if the first one is down.",
  },
  {
    question: "What are the system requirements?",
    answer:
      "Windows 10 or 11 (about 104 MB), or a Mac on either Apple silicon or Intel (about 232–239 MB). For fully local answers you also need Ollama with at least one model pulled — llama3.2 for text and llava for screenshots is a good start. If you would rather use a hosted model, configure any OpenAI-compatible endpoint instead.",
  },
  {
    question: "Which Mac download should I pick?",
    answer:
      "M-series Macs (M1 and later) take the Apple silicon disk image; Macs with an Intel processor take the Intel one. If you are unsure, open the Apple menu and choose About This Mac — the Chip or Processor line tells you which you have.",
  },
  {
    question: "Why is the download password-protected?",
    answer:
      "Notes is in early access and we are rolling it out in small groups so feedback stays manageable. The password is free — ask through the contact page or WhatsApp and we will send it, usually the same day.",
  },
  {
    question: "Can people see it when I share my screen?",
    answer:
      "By default, no. Content protection excludes the window from screen shares and recordings, the way a private notepad should be. Being honest about the limits: the Notes process is still visible in Task Manager, some OS-level capture tools cannot be excluded, and you can turn the protection off whenever you want the window to be shareable.",
  },
];

export default function NotesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Notes", path: "/notes" },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: `${siteConfig.name} Notes`,
          applicationCategory: "ProductivityApplication",
          operatingSystem: "Windows 10, Windows 11, macOS",
          softwareVersion: "1.1.0",
          fileSize: "104MB",
          url: `${siteConfig.url}/notes`,
          downloadUrl: `${siteConfig.url}/notes#download`,
          description:
            "A private, local-first AI desktop assistant: a translucent overlay that captures your screen, answers in streaming chat, and runs against models on your own machine by default.",
          // The app is genuinely free; the only gate is an early-access
          // password. A zero-price Offer is the accurate machine-readable
          // statement of that.
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            url: `${siteConfig.url}/notes`,
          },
          provider: {
            "@type": "Organization",
            "@id": `${siteConfig.url}/#organization`,
            name: siteConfig.name,
          },
        }}
      />
      <JsonLd data={faqSchema(FAQS)} />

      <PageHeader
        eyebrow="Notes"
        title="A private AI assistant that lives on your desktop"
        description="One shortcut summons a quiet, translucent window over whatever you are doing. Capture the screen, ask in plain language, and get streaming answers — from a model running on your own machine, so your work never has to leave it."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Notes", href: "/notes" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="#download">
              Download free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/contact">Get the access password</Link>
          </Button>
          <Badge variant="muted">
            <Monitor className="size-3.5" />
            Windows
          </Badge>
          <Badge variant="muted">
            <Apple className="size-3.5" />
            macOS · Intel &amp; Apple silicon
          </Badge>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Four steps, and the slowest one is choosing which model to run.
          </p>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
                    <step.icon className="size-4.5" />
                  </span>
                  <span className="text-muted-foreground text-xs font-medium">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            Why it is different
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Most AI assistants live in a browser tab and send everything to a
            cloud. Notes lives where you work and keeps the work where it is.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]"
              >
                <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
                  <feature.icon className="size-4.5" />
                </span>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            Everything included
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section spacing="sm" id="download">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            Download Notes
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Version 1.1.0 · free during early access. The download is
            password-protected while we roll it out in small groups —{" "}
            <Link
              href="/contact"
              className="text-primary underline-offset-4 hover:underline"
            >
              ask us for the password
            </Link>{" "}
            and we will send it over.
          </p>
          <div className="mt-8">
            <NotesDownloads />
          </div>
          <div className="text-muted-foreground mt-4 space-y-1 text-xs leading-relaxed">
            <p>
              SHA-512, Windows installer:{" "}
              <code className="break-all">
                RGokyM3MNXjXfm35gRHQtHpJShmVwA8P1qDJsEYAuOxOWno9ewkLHwtX+vq9gNpZnp+qbEj8NH7pLxNNX2JMxw==
              </code>
            </p>
            <p>
              SHA-512, macOS Apple silicon:{" "}
              <code className="break-all">
                ySUQ1OqQDuZ4qycrEyK5GNOnKSpXyDaempA64Bf8OMYxhy8kfAGD70jcZRc7TwQ+u4YXo8lY8U9VWVa0QMsmXg==
              </code>
            </p>
            <p>
              SHA-512, macOS Intel:{" "}
              <code className="break-all">
                W3u295Aax3vDsBQB78oD8rJRoCeOpcQmzW2O5yvEZCNRcJQQ0rheH4j5MaJjeV2r2Am4DEpTRWICtDrJ+gI6Qw==
              </code>
            </p>
          </div>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            Common questions
          </h2>
          <dl className="mt-6 space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.question}>
                <dt className="font-medium">{faq.question}</dt>
                <dd className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <CtaSection
        title="Put a private AI on your desktop today."
        description="Free for Windows and macOS during early access. Ask us for the password and you will be running it in minutes."
        primary={{ label: "Download Notes", href: "/notes#download" }}
        secondary={{ label: "Get the password", href: "/contact" }}
      />
    </>
  );
}
