import { organizationSchema, websiteSchema } from "@/lib/seo";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/navigation/site-footer";
import { ScrollProgress } from "@/components/scroll-progress";
import { BackToTop } from "@/components/back-to-top";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { JsonLd } from "@/components/json-ld";
import { MotionProvider } from "@/components/motion/motion-provider";

/**
 * Layout for the public marketing site.
 *
 * Holds everything that used to sit in the root layout: the header, footer,
 * scroll affordances, motion provider, and the site-wide Organization and
 * WebSite structured data. Moving it here keeps it off the admin panel — and
 * keeps the Organization JSON-LD off admin pages, where it would describe a
 * `noindex` route to no purpose.
 *
 * `(site)` is a route group, so it contributes nothing to any URL: `/about`
 * still resolves from `(site)/about/page.tsx`.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />
      <ScrollProgress />
      <MotionProvider>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <BackToTop />
        <WhatsAppButton />
      </MotionProvider>
    </>
  );
}
