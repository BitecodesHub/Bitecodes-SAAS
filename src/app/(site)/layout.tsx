import { Suspense } from "react";
import { organizationSchema, websiteSchema } from "@/lib/seo";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/navigation/site-footer";
import { ScrollProgress } from "@/components/scroll-progress";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { JsonLd } from "@/components/json-ld";
import { AnalyticsBeacon } from "@/components/analytics/analytics-beacon";
import { SiteAssistant } from "@/components/assistant/site-assistant";
import { StickyCTABar } from "@/components/sticky-cta-bar";

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
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <WhatsAppButton />
      {/*
        Client islands. Suspense keeps any URL read inside them (search
        params) from opting the static marketing pages into dynamic rendering.
      */}
      <Suspense fallback={null}>
        <AnalyticsBeacon />
      </Suspense>
      <Suspense fallback={null}>
        <SiteAssistant />
      </Suspense>
      <StickyCTABar />
    </>
  );
}
