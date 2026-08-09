import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  Globe,
  Code2,
  Mail,
  ShieldCheck,
  Palette,
  Clock,
  Sparkles,
  Check,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { createMetadata, breadcrumbSchema, faqSchema } from "@/lib/seo";
import { formatPackPrice, packsFor } from "@/lib/server/billing/packs";
import { siteConfig } from "@/lib/site";

const BOOKING_PACKS = packsFor("bookings");

export const metadata: Metadata = createMetadata({
  title: "Booking Calendar for Any Website — Free Credits",
  description:
    "Publish your real availability and embed a booking calendar on any website with one line of code. Timezone-correct, impossible to double-book, free credits to start.",
  path: "/booking",
});

const STEPS = [
  {
    icon: Clock,
    title: "Set your hours",
    body: "Choose the days and times you take appointments, how long each one runs, how much notice you need, and how far ahead people may book.",
  },
  {
    icon: Globe,
    title: "Lock it to your domains",
    body: "List the sites allowed to show your calendar, wildcards included. Anywhere else is refused, so nobody can put your diary on their page.",
  },
  {
    icon: Code2,
    title: "Paste one line",
    body: "Copy the script tag or the iframe and drop it into your site. No build step, no framework, no npm install.",
  },
  {
    icon: Mail,
    title: "Get booked",
    body: "The visitor picks a time and confirms. You are emailed, they are emailed, and the appointment lands in your diary.",
  },
];

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Correct across timezones",
    body: "You set your hours in your timezone; every visitor sees them in theirs, with the timezone named on screen. Times are recalculated rather than stored, so a daylight-saving change never shifts an appointment by an hour.",
  },
  {
    icon: ShieldCheck,
    title: "Two people cannot take one slot",
    body: "The last free slot is settled by the database, not by a check that two simultaneous visitors could both pass. Whoever loses is told immediately, shown the times still free, and never charged.",
  },
  {
    icon: Palette,
    title: "Matches your site",
    body: "Set the accent colour and button text; the calendar renders inside a shadow root so your CSS and ours can never fight.",
  },
  {
    icon: Sparkles,
    title: "Two ways to embed",
    body: "A script tag for an inline calendar, or an iframe for zero JavaScript on your page. Same diary, same bookings.",
  },
];

const INCLUDED = [
  "Unlimited calendars on one account",
  "Weekly opening hours, with several windows a day if you need them",
  "Minimum notice and a booking horizon you control",
  "Blackout dates for holidays and days off",
  "Domain allowlist with wildcard support",
  "Email to you and a confirmation to the customer, automatically",
  "A diary you can search, with one-click cancellation that frees the slot",
  "Credits never expire while your account is open",
];

const FAQS = [
  {
    question: "What happens if two people click the same time at once?",
    answer:
      "One of them gets it and the other is told straight away, shown the times that are still free, and not charged a credit. This is settled by a uniqueness rule in the database rather than by checking first and then writing, because two simultaneous visitors can both pass a check before either has written anything.",
  },
  {
    question: "Does it handle timezones and daylight saving?",
    answer:
      "Yes. You set your hours in your own timezone and each visitor sees them converted to theirs, with the timezone stated on screen so nobody books three in the morning by accident. Slots are recalculated from your rules on every request rather than stored, so when the clocks change your nine o'clock stays nine o'clock.",
  },
  {
    question: "Do I need a developer to install it?",
    answer:
      "No. Copy one line from your dashboard and paste it into your page where you want the calendar to appear. If your site builder allows a custom HTML or embed block, that is enough. There is also an iframe version that puts no JavaScript on your page at all.",
  },
  {
    question: "What does a booking cost?",
    answer:
      "You buy credits up front and one confirmed booking spends one credit. Nothing is charged for showing the calendar, for a visitor browsing times, or for a booking that fails because someone else took the slot. Credits do not expire while your account is open, and there is no monthly fee.",
  },
  {
    question: "Can someone put my calendar on their own website?",
    answer:
      "No. Each calendar carries a list of domains it may run on, and a request from anywhere else is refused before anything is booked. You can change that list at any time, and rotate the embed token if it ever needs replacing.",
  },
  {
    question: "What happens when I run out of credits?",
    answer:
      "New bookings are turned away with a message asking the visitor to contact you directly, and you are told your balance has run out. Existing bookings are unaffected. Your dashboard shows the remaining balance on every calendar so it should not come as a surprise.",
  },
];

export default function BookingPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Booking", path: "/booking" },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: `${siteConfig.name} Booking`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          url: `${siteConfig.url}/booking`,
          description:
            "Embeddable booking calendar: timezone-correct availability, double-booking-proof scheduling, a customisable widget, and prepaid per-booking pricing.",
          // Derived from the packs a customer can actually buy — see the same
          // note on /ai-chatbot: a fictional price here would be published
          // misinformation, since this is machine-read by search engines and
          // AI assistants, not just marketing copy a person skims past.
          offers: BOOKING_PACKS.map((pack) => ({
            "@type": "Offer",
            name: `${pack.label} — ${pack.credits.toLocaleString()} bookings`,
            price: (pack.amount / 100).toFixed(2),
            priceCurrency: pack.currency,
            url: `${siteConfig.url}/booking`,
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
        eyebrow="Booking"
        title="A booking calendar you can paste into any website"
        description="Publish the hours you actually work, let people pick a time that suits them, and have it land in your diary. One line of code, correct in every timezone, and impossible to double-book."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Booking", href: "/booking" },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page flex flex-wrap gap-3">
          <Button asChild variant="gradient" size="lg">
            <Link href="/signup">
              Get started free
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
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Four steps, and the longest one is deciding your opening hours.
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
            What makes it reliable
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
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
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section spacing="sm" id="pricing">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">
            Pay per booking, not per month
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Credits are bought up front and spent one per confirmed booking.
            Showing the calendar is free, and a booking that loses a slot to
            someone else is refunded automatically.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {BOOKING_PACKS.map((pack) => (
              <div
                key={pack.packId}
                className={`border-border bg-card relative rounded-2xl border p-6 shadow-[var(--shadow-soft)] ${
                  pack.popular ? "ring-primary/30 ring-2" : ""
                }`}
              >
                {pack.popular && (
                  <Badge className="absolute -top-2.5 right-5">
                    Most chosen
                  </Badge>
                )}
                <h3 className="font-semibold">{pack.label}</h3>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  {formatPackPrice(pack)}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {pack.credits.toLocaleString()} bookings
                </p>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {pack.blurb}
                </p>
              </div>
            ))}
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
        title="Let people book you without the back and forth"
        description="Tell us the hours you work and we will have a calendar live on your site."
        primary={{ label: "Create your account", href: "/signup" }}
        secondary={{ label: "Talk to us first", href: "/contact" }}
      />
    </>
  );
}
