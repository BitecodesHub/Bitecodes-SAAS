import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
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
              <ContactItem icon={Clock} label="Response time">
                Within one business day
              </ContactItem>
            </div>

            <div>
              <p className="text-sm font-semibold">Follow along</p>
              <div className="mt-3 flex gap-2">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary flex size-10 items-center justify-center rounded-full border transition-colors"
                  >
                    <s.icon className="size-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Map placeholder — no third-party embed (privacy + performance). */}
            <div className="border-border bg-card relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border">
              <div className="bg-grid absolute inset-0 opacity-40" />
              <div className="relative flex flex-col items-center gap-2 text-center">
                <MapPin className="text-primary size-7" />
                <p className="text-sm font-medium">
                  {siteConfig.contact.address.full}
                </p>
                <p className="text-muted-foreground text-xs">
                  Map embed placeholder
                </p>
              </div>
            </div>
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
