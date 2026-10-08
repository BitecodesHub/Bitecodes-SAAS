import type { Metadata } from "next";
import Link from "next/link";
import {
  Camera,
  Gauge,
  KeyRound,
  Laptop,
  MessageSquareText,
  Mic,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import {
  NotesDownloads,
  type NotesDownload,
} from "@/components/notes/notes-downloads";
import { getRelease } from "@/lib/server/desktop/release";
import { createMetadata, breadcrumbSchema, faqSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Notes — Free AI Desktop Assistant for Mac and Windows",
  description:
    "Notes is a free AI assistant for your desktop. Ask questions, get a screenshot explained, and talk it through — sign in with a free Bitecodes account. macOS and Windows.",
  path: "/notes",
});

/** Download links come from the admin "App updates" feed; re-read every 5 minutes. */
export const revalidate = 300;

const FEATURES = [
  {
    icon: Camera,
    title: "Explain what is on screen",
    body: "Take a screenshot with a shortcut and Notes reads it — a coding problem, an error message, a chart — and explains or solves it.",
  },
  {
    icon: MessageSquareText,
    title: "Chat that stays out of the way",
    body: "A small, always-on-top panel you can move anywhere. Ask a question without switching windows.",
  },
  {
    icon: Mic,
    title: "Voice",
    body: "Record a question or a conversation and get it transcribed and answered.",
  },
  {
    icon: Gauge,
    title: "Fast, capable models",
    body: "Answers stream in within a second or two. We pick and route between leading AI models for you, with automatic fallback.",
  },
  {
    icon: KeyRound,
    title: "No API keys",
    body: "Sign in with your free Bitecodes account in the browser. No keys to buy, paste or manage.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Screenshots are used only to answer and never stored. Disconnect any device at any time from your account.",
  },
];

const FAQS = [
  {
    question: "Is Notes really free?",
    answer:
      "Yes. Download it, sign in with a free Bitecodes account, and use it. A generous daily allowance applies so the service stays fast for everyone; it resets every day.",
  },
  {
    question: "Which computers does it run on?",
    answer:
      "macOS (Apple Silicon and Intel) and Windows 10 or 11 (x64 and ARM). On a Mac, allow Screen Recording when asked so screenshots work.",
  },
  {
    question: "Why does my computer warn me when I open it?",
    answer:
      "Notes is not yet signed with an Apple or Microsoft developer certificate, so the first launch shows a warning. On a Mac, right-click Notes in Applications and choose Open. On Windows, click “More info” and then “Run anyway”. You only need to do this once.",
  },
  {
    question: "How do I sign in?",
    answer:
      "Click “Sign in with Bitecodes” in the app. Your browser opens; sign in, type the code shown in the app, and approve. No password is ever typed into the app.",
  },
  {
    question: "What happens to my data?",
    answer:
      "Your prompts and answers are stored for 180 days so your account history works, then deleted automatically. Screenshots are not stored. Requests are processed by the AI providers we use. See the privacy policy for details.",
  },
];

const LABELS: Record<NotesDownload["key"], { label: string; detail: string }> =
  {
    macArm64: { label: "macOS (Apple Silicon)", detail: "M1 and newer · .dmg" },
    macX64: { label: "macOS (Intel)", detail: "Intel Macs · .dmg" },
    winX64: { label: "Windows", detail: "Windows 10/11 · 64-bit · .exe" },
    winArm64: { label: "Windows on ARM", detail: "Snapdragon / ARM64 · .exe" },
  };

export default async function NotesPage() {
  const release = await getRelease();
  const downloads: NotesDownload[] = (
    Object.keys(LABELS) as NotesDownload["key"][]
  )
    .filter((k) => release.downloads[k])
    .map((k) => ({ key: k, url: release.downloads[k], ...LABELS[k] }));

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
          name: "Notes",
          applicationCategory: "ProductivityApplication",
          operatingSystem: "macOS, Windows",
          url: `${siteConfig.url}/notes`,
          ...(release.latestVersion
            ? { softwareVersion: release.latestVersion }
            : {}),
          description:
            "Free AI desktop assistant: screenshot explanations, chat and voice. Sign in with a Bitecodes account.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          provider: {
            "@type": "Organization",
            "@id": `${siteConfig.url}/#organization`,
            name: siteConfig.name,
          },
        }}
      />
      <JsonLd data={faqSchema(FAQS)} />

      <PageHeader
        eyebrow="Free desktop app"
        title={
          <>
            Notes — an AI assistant <span>on your desktop, free.</span>
          </>
        }
        description="Ask anything, get what is on your screen explained, and talk it through. Sign in with a free Bitecodes account — no API keys, no card."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Notes", href: "/notes" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page mx-auto max-w-3xl" id="download">
          <NotesDownloads
            downloads={downloads}
            version={release.latestVersion || null}
          />
          <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
            First launch: on a Mac, right-click Notes and choose Open; on
            Windows, choose “More info” → “Run anyway”. Then click “Sign in with
            Bitecodes”. No account yet?{" "}
            <Link href="/signup" className="underline underline-offset-2">
              Create one free
            </Link>
            .
          </p>
        </div>
      </Section>

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            What it does
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

      <Section spacing="sm">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            Get started in three steps
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              [
                "Download",
                "Pick the build for your computer above and install it.",
              ],
              [
                "Sign in",
                "Click “Sign in with Bitecodes”, sign in in your browser, and type the code from the app.",
              ],
              [
                "Ask",
                "Type a question, or press the screenshot shortcut and let Notes explain what it sees.",
              ],
            ].map(([title, body], i) => (
              <li
                key={title}
                className="border-border bg-card rounded-2xl border p-5"
              >
                <span className="text-muted-foreground text-xs font-medium">
                  Step {i + 1}
                </span>
                <h3 className="mt-1 flex items-center gap-2 font-semibold">
                  {i === 0 && <Laptop className="size-4" aria-hidden="true" />}
                  {title}
                </h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

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
          <p className="text-muted-foreground mt-6 text-xs">
            Details on data handling are in our{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </Section>

      <CtaSection
        title="Your desktop, with an assistant on call."
        description="Free to download. Free to use with a Bitecodes account."
        primary={{ label: "Download Notes", href: "/notes#download" }}
        secondary={{ label: "Create a free account", href: "/signup" }}
      />
    </>
  );
}
