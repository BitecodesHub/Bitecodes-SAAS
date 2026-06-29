/**
 * Central site configuration — the single source of truth for company
 * identity, contact details, and canonical URLs.
 *
 * TODO(client): Replace the placeholder contact values below with the real
 * Bitecodes email, phone, and office address before launch. They are
 * intentionally centralized here so the swap is a one-file change.
 */
export const siteConfig = {
  name: "Bitecodes",
  legalName: "Bitecodes",
  // Used for metadataBase, canonical URLs, sitemap, and Open Graph.
  url: "https://bitecodes.com",
  tagline: "Software, engineered with intent.",
  description:
    "Bitecodes is a software outsourcing studio building high-performance websites, web & enterprise applications, SaaS platforms, APIs, and AI automation for startups and enterprises worldwide.",
  founded: 2021,
  founder: "Ismail",

  // --- Contact (PLACEHOLDERS — replace before launch) ---
  contact: {
    email: "hello@bitecodes.com", // TODO(client)
    salesEmail: "sales@bitecodes.com", // TODO(client)
    phone: "+91 00000 00000", // TODO(client)
    phoneHref: "tel:+910000000000", // TODO(client)
    address: {
      line1: "Remote-first studio", // TODO(client)
      city: "Ahmedabad",
      region: "Gujarat",
      country: "India",
      full: "Remote-first · Ahmedabad, India", // TODO(client)
    },
  },

  social: {
    github: "https://github.com/bitecodes",
    linkedin: "https://www.linkedin.com/company/bitecodes",
    x: "https://x.com/bitecodes",
    instagram: "https://instagram.com/bitecodes",
  },

  // Default Open Graph image (generated at /opengraph-image).
  ogImage: "/opengraph-image",
  locale: "en_US",
  twitterHandle: "@bitecodes",
} as const;

export type SiteConfig = typeof siteConfig;
