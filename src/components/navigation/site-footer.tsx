import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
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
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-border bg-muted/50 relative mt-24 border-t">
      <div className="container-page py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div className="max-w-sm">
            <Logo />
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              {siteConfig.description}
            </p>
            <div className="mt-6 space-y-2 text-sm">
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
              >
                <Mail className="size-4" />
                {siteConfig.contact.email}
              </a>
              <p className="text-muted-foreground flex items-center gap-2">
                <MapPin className="size-4" />
                {siteConfig.contact.address.full}
              </p>
            </div>
            <div className="mt-6 flex gap-2">
              {socialLinks.map((s) => (
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

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {footerNav.map((col) => (
              <div key={col.heading}>
                <p className="text-sm font-semibold">{col.heading}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
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

        <div className="border-border text-muted-foreground mt-14 flex flex-col items-center justify-between gap-4 border-t pt-8 text-sm sm:flex-row">
          <p>
            © {year} {siteConfig.legalName}. All rights reserved.
          </p>
          <p>{siteConfig.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
