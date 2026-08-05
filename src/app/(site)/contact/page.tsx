import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { ContactForm } from "@/components/contact-form";
import {
  GithubIcon,
  InstagramIcon,
  LinkedinIcon,
  XIcon,
} from "@/components/social-icons";
import { JsonLd } from "@/components/json-ld";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Contact",
  description:
    "Start a project with Bitecodes. Tell us what you're building and we'll reply within one business day.",
  path: "/contact",
});

const socials = [
  { label: "GitHub", href: siteConfig.social.github, icon: GithubIcon },
  { label: "LinkedIn", href: siteConfig.social.linkedin, icon: LinkedinIcon },
  { label: "X", href: siteConfig.social.x, icon: XIcon },
  {
    label: "Instagram",
    href: siteConfig.social.instagram,
    icon: InstagramIcon,
  },
];

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
      <PageHeader
        eyebrow="Contact"
        title="Let's talk about your project"
        description="Tell us a little about what you're working on. We read every message and reply within one business day."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Contact", href: "/contact" },
        ]}
      />
      <Section>
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <Reveal className="space-y-6">
            <div className="space-y-4">
              <ContactItem icon={Mail} label="Email">
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="hover:text-primary transition-colors"
                >
                  {siteConfig.contact.email}
                </a>
              </ContactItem>
              <ContactItem icon={Phone} label="Phone">
                <a
                  href={siteConfig.contact.phoneHref}
                  className="hover:text-primary transition-colors"
                >
                  {siteConfig.contact.phone}
                </a>
              </ContactItem>
              <ContactItem icon={MapPin} label="Location">
                {siteConfig.contact.address.full}
              </ContactItem>
              <ContactItem icon={Clock} label="Office hours">
                Monday–Friday · 10:00–18:00 IST
              </ContactItem>
              <ContactItem icon={MessageCircle} label="WhatsApp">
                <a
                  href={siteConfig.contact.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {siteConfig.contact.phone}
                </a>
              </ContactItem>
            </div>

            <div>
              <p className="text-sm font-semibold">Follow along</p>
              <div className="mt-3 flex gap-3">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary flex size-11 items-center justify-center rounded-full border transition-colors"
                  >
                    <s.icon className="size-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Map opens only after explicit interaction, avoiding a tracking embed. */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${siteConfig.contact.address.city}, ${siteConfig.contact.address.region}, ${siteConfig.contact.address.country}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="border-border bg-card group hover:border-primary/40 relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border transition-colors"
            >
              <div className="bg-grid absolute inset-0 opacity-40" />
              <div className="relative flex flex-col items-center gap-2 text-center">
                <MapPin className="text-primary size-7 transition-transform group-hover:-translate-y-0.5" />
                <p className="text-sm font-medium">
                  {siteConfig.contact.address.full}
                </p>
                <p className="text-muted-foreground text-xs">
                  Open location in Google Maps
                </p>
              </div>
            </a>
          </Reveal>

          <Reveal direction="left">
            <Suspense
              fallback={
                <div className="border-border bg-card h-96 rounded-2xl border" />
              }
            >
              <ContactForm />
            </Suspense>
          </Reveal>
        </div>
      </Section>
      <Section className="border-border bg-secondary/35 border-t" spacing="sm">
        <div className="container-page max-w-3xl">
          <h2 className="text-center text-2xl font-semibold">
            Before you send a brief
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              [
                "What happens next?",
                "We review the goal, scope, constraints, and timing, then reply with useful next steps within one business day.",
              ],
              [
                "Do I need a complete specification?",
                "No. A clear problem, intended users, must-have outcome, and rough timing are enough to begin discovery.",
              ],
              [
                "Will the form save my enquiry?",
                "Yes. A valid submission is stored for follow-up and triggers configured team notifications. You receive a reference on success.",
              ],
              [
                "Can I request an NDA?",
                "Yes. Mention it in your message and avoid sharing confidential details until an appropriate agreement is in place.",
              ],
            ].map(([question, answer]) => (
              <div
                key={question}
                className="border-border bg-card rounded-2xl border p-5"
              >
                <h3 className="text-sm font-semibold">{question}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

function ContactItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-sm">{children}</p>
      </div>
    </div>
  );
}
