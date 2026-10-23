import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import {
  GithubIcon,
  InstagramIcon,
  LinkedinIcon,
  XIcon,
} from "@/components/social-icons";
import { footerNav } from "@/data/navigation";
import { siteConfig } from "@/lib/site";

const socialLinks = [
  { label: "GitHub", href: siteConfig.social.github, icon: GithubIcon },
  { label: "LinkedIn", href: siteConfig.social.linkedin, icon: LinkedinIcon },
  { label: "X", href: siteConfig.social.x, icon: XIcon },
  {
    label: "Instagram",
    href: siteConfig.social.instagram,
    icon: InstagramIcon,
  },
].filter((link): link is typeof link & { href: string } => link.href !== null);

/**
 * Apple-style utility footer: quiet type, dense link columns, and a clear
 * legal row. It carries navigation, not promotion, so the closing section of
 * each page keeps the last word.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-surface-2 border-t border-black/[0.06] text-[13px] dark:border-white/10">
      <div className="container-page py-12 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_2.5fr] lg:gap-16">
          <div className="max-w-sm">
            <Logo />
            <p className="text-muted-foreground mt-4 leading-relaxed">
              {siteConfig.description}
            </p>
            <div className="mt-6 space-y-1">
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-2.5 transition-colors"
              >
                <Mail className="size-4" aria-hidden />
                {siteConfig.contact.email}
              </a>
              <a
                href={siteConfig.contact.phoneHref}
                className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-2.5 transition-colors"
              >
                <Phone className="size-4" aria-hidden />
                {siteConfig.contact.phone}
              </a>
              <a
                href={siteConfig.contact.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-2.5 transition-colors"
              >
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp us
              </a>
              <p className="text-muted-foreground flex min-h-11 items-center gap-2.5">
                <MapPin className="size-4 shrink-0" aria-hidden />
                {siteConfig.contact.address.full}
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="text-muted-foreground hover:bg-background hover:text-foreground flex size-11 items-center justify-center rounded-full transition-colors"
                >
                  <s.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
            {footerNav.map((col) => (
              <div key={col.heading}>
                <p className="text-[13px] font-semibold tracking-[0.02em]">
                  {col.heading}
                </p>
                <ul className="mt-3 space-y-0.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 min-w-11 items-center transition-colors"
                      >
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="text-muted-foreground mt-12 flex flex-col gap-3 border-t border-black/[0.06] pt-6 text-[13px] sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <p>
            © {year} {siteConfig.legalName}. All rights reserved.
          </p>
          <p className="text-balance">{siteConfig.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
