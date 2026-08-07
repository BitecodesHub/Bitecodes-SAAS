/**
 * Central site configuration — the single source of truth for company
 * identity, contact details, and canonical URLs.
 */
export const siteConfig = {
  name: "Bitecodes",
  legalName: "Bitecodes",
  // Used for metadataBase, canonical URLs, sitemap, and Open Graph.
  //
  // Must be the host that is actually served. The apex answers 308 to `www`, so
  // an apex value here made every one of the 62 URLs in the sitemap a redirect,
  // and pointed each canonical tag at a URL that is not the one serving the
  // page. `www` is the canonical host because it is the one already indexed —
  // flipping the redirect the other way would be a larger change than this, and
  // would force re-indexing.
  url: "https://www.bitecodes.com",
  tagline: "Software, engineered with intent.",
  description:
    "Bitecodes is a software outsourcing studio building high-performance websites, web & enterprise applications, SaaS platforms, APIs, and AI automation for startups and enterprises worldwide.",
  founded: 2021,
  founder: "Ismail",

  contact: {
    email: "bitecodes.global@gmail.com",
    salesEmail: "bitecodes.global@gmail.com",
    phone: "+91 94287 67709",
    phoneHref: "tel:+919428767709",
    /** Same number as `phone`; wa.me requires digits only. */
    whatsapp: "https://wa.me/919428767709",
    address: {
      line1: "Remote-first studio",
      city: "Ahmedabad",
      region: "Gujarat",
      country: "India",
      full: "Remote-first · Ahmedabad, India",
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
