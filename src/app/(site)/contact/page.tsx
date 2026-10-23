import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ArrowRight,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
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
import { createMetadata, breadcrumbSchema, webPageSchema } from "@/lib/seo";
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
].filter((link): link is typeof link & { href: string } => link.href !== null);

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
      <JsonLd
        data={webPageSchema({
          path: "/contact",
          name: "Contact Bitecodes",
          description:
            "Contact Bitecodes about a website, web application, SaaS product, API, or AI automation project. Office hours are Monday to Friday, 10:00 to 18:00 IST.",
          speakableSelectors: ["h1", "main p:first-of-type"],
        })}
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
      <Section className="bg-surface-2">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <Reveal className="space-y-8 lg:sticky lg:top-24">
            <div className="space-y-5">
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
              <p className="text-muted-foreground text-[13px] font-medium tracking-[0.06em] uppercase">
                Follow along
              </p>
              <div className="mt-3 flex gap-3">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="bg-background text-muted-foreground hover:text-primary flex size-11 items-center justify-center rounded-full shadow-[var(--shadow-soft)] transition-colors"
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
              className="group bg-background flex flex-col items-start gap-2 rounded-[28px] p-7 transition-all duration-300 hover:-translate-y-0.5"
            >
              <MapPin className="text-primary size-6 transition-transform group-hover:-translate-y-0.5" />
              <p className="mt-2 text-[17px] font-medium">
                {siteConfig.contact.address.full}
              </p>
              <p className="text-muted-foreground group-hover:text-primary inline-flex items-center gap-1.5 text-[13px] transition-colors">
                Open location in Google Maps
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </p>
            </a>
          </Reveal>

          <Reveal direction="left">
            <Suspense
              fallback={
                <div className="bg-background h-96 rounded-[32px] shadow-[var(--shadow-soft)]" />
              }
            >
              <ContactForm />
            </Suspense>
          </Reveal>
        </div>
      </Section>
      <Section spacing="sm">
        <div className="container-page max-w-4xl">
          <h2 className="text-center text-[clamp(1.875rem,3vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.025em]">
            Before you send a brief
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
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
              <div key={question} className="bg-surface-2 rounded-[24px] p-7">
                <h3 className="text-[17px] font-semibold">{question}</h3>
                <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
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
      <span className="bg-background text-primary flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-[var(--shadow-soft)]">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-muted-foreground text-[13px] font-medium tracking-[0.06em] uppercase">
          {label}
        </p>
        <p className="mt-1 text-[17px] leading-snug">{children}</p>
      </div>
    </div>
  );
}
