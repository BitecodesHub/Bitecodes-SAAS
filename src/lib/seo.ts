import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import { technologies } from "@/data/technologies";
import { founder } from "@/data/founder";
import { getPricing, CURRENCIES, convertPrice } from "@/lib/pricing";
import type { Service } from "@/types/content";

// priceValidUntil: ~4 months ahead, computed once at module load. Stale
// dates trigger Google structured-data warnings, so derive rather than
// hardcode.
const PRICE_VALID_UNTIL = new Date(Date.now() + 1000 * 60 * 60 * 24 * 120)
  .toISOString()
  .slice(0, 10);

/**
 * RSS/Atom feed autodiscovery entries for <link rel="alternate">. Shared by
 * the root layout AND createMetadata: Next wholesale-replaces (does not
 * deep-merge) the `alternates` object with each page's metadata, so unless
 * per-page metadata also carries these `types`, the feed links vanish from
 * every route's <head>. One source guarantees they always ship.
 */
export const FEED_ALTERNATE_TYPES = {
  "application/rss+xml": [{ url: "/rss.xml", title: "Bitecodes Blog — RSS" }],
  "application/atom+xml": [
    { url: "/atom.xml", title: "Bitecodes Blog — Atom" },
  ],
};

interface PageMetaInput {
  title?: string;
  description?: string;
  /** Path beginning with "/", used for canonical + OG url. */
  path?: string;
}

/**
 * Build per-page Metadata with sensible, SEO-complete defaults
 * (canonical, Open Graph, Twitter). metadataBase is set in the root layout,
 * and the Open Graph image is supplied by the file-based `opengraph-image`
 * convention, so it does not need to be repeated here.
 */
export function createMetadata({
  title,
  description = siteConfig.description,
  path = "/",
}: PageMetaInput = {}): Metadata {
  const fullTitle = title
    ? `${title} — ${siteConfig.name}`
    : `${siteConfig.name} — ${siteConfig.tagline}`;
  const url = path;

  return {
    // Pass the raw segment so the layout's "%s — Bitecodes" template applies
    // exactly once; use an absolute title for the home page (no title arg).
    title: title
      ? title
      : { absolute: `${siteConfig.name} — ${siteConfig.tagline}` },
    description,
    alternates: { canonical: url, types: FEED_ALTERNATE_TYPES },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: fullTitle,
      description,
      url,
      locale: siteConfig.locale,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      creator: siteConfig.twitterHandle,
      site: siteConfig.twitterHandle,
    },
  };
}

/** Organization JSON-LD for the site root (rich, AI-citation friendly). */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],
    "@id": `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    url: siteConfig.url,
    logo: {
      "@type": "ImageObject",
      url: `${siteConfig.url}/apple-icon`,
      width: 180,
      height: 180,
    },
    image: `${siteConfig.url}/opengraph-image`,
    description: siteConfig.description,
    slogan: siteConfig.tagline,
    foundingDate: String(siteConfig.founded),
    founder: {
      "@type": "Person",
      name: siteConfig.founder,
      jobTitle: founder.title,
    },
    email: siteConfig.contact.email,
    telephone: siteConfig.contact.phone,
    address: {
      "@type": "PostalAddress",
      addressLocality: siteConfig.contact.address.city,
      addressRegion: siteConfig.contact.address.region,
      addressCountry: siteConfig.contact.address.country,
    },
    areaServed: "Worldwide",
    knowsAbout: technologies.map((t) => t.name),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: siteConfig.contact.salesEmail,
      availableLanguage: ["English"],
    },
    sameAs: [
      siteConfig.social.github,
      siteConfig.social.linkedin,
      siteConfig.social.x,
      siteConfig.social.instagram,
    ],
  };
}

/** Service JSON-LD for a single service offering, with multi-currency Offers. */
export function serviceSchema(service: Service) {
  const serviceUrl = `${siteConfig.url}/services/${service.slug}`;
  const pricing = getPricing(service.slug);

  // 3 Offer nodes (USD, INR, AUD) — allowed by Google: multiple Offer objects
  // under Service.offers. Each carries a priceCurrency so regional crawlers
  // and answer engines can pick the relevant one. The numeric price matches
  // the visible HTML rendered from src/lib/pricing.priceRows(slug).
  const offers = pricing
    ? CURRENCIES.map((c) => {
        const amount = convertPrice(pricing.startingFromUSD, c.code);
        const offer: Record<string, unknown> = {
          "@type": "Offer",
          price: String(amount),
          priceCurrency: c.code,
          availability: "https://schema.org/InStock",
          url: serviceUrl,
          priceValidUntil: PRICE_VALID_UNTIL,
          itemOffered: {
            "@type": "Service",
            name: service.title,
            url: serviceUrl,
          },
        };
        if (pricing.unit === "month") {
          // Recurring retainer — signal the monthly billing unit.
          offer.eligibleTransactionVolume = {
            "@type": "UnitPriceSpecification",
            priceCurrency: c.code,
            price: String(amount),
            billingDuration: "P1M",
          };
        }
        return offer;
      })
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    serviceType: service.title,
    description: service.description,
    url: serviceUrl,
    areaServed: "Worldwide",
    availableLanguage: ["English"],
    provider: {
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
    },
    ...(offers ? { offers } : {}),
  };
}

/** Person JSON-LD for the founder. */
export function personSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: founder.name,
    jobTitle: founder.title,
    description: founder.short,
    url: `${siteConfig.url}/about`,
    knowsAbout: founder.expertise,
    worksFor: {
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };
}

/** WebSite JSON-LD. */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
  };
}

/** FAQPage JSON-LD from a list of Q&A. */
export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/** BreadcrumbList JSON-LD. */
export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteConfig.url}${item.path}`,
    })),
  };
}
