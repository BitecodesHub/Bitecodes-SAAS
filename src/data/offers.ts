/**
 * Productized offers.
 *
 * The consultant recommends "Launch", "Growth", "Scale", or "Discovery first",
 * and the homepage previews engagement types. Neither had a page that defined
 * what the names actually buy, so a visitor could see a package name and a
 * floor price but no inclusions, exclusions, timeline, or guarantee.
 *
 * Every price here is the published floor of the service it belongs to in
 * `src/lib/pricing.ts`. That is the single source of truth: this file may add
 * inclusions and a timeline, but it must never invent a lower price or a
 * commitment that `src/data/guarantees.ts` does not make. The guarantee slugs
 * are resolved against that file at render time so the copy cannot drift.
 */

export interface OfferPackage {
  slug: "launch" | "growth" | "scale";
  name: string;
  /** One plain sentence a visitor can repeat to a colleague. */
  summary: string;
  /** Canonical price. Floors come from SERVICE_PRICING for `serviceSlugs`. */
  priceUSD: number;
  timeline: { minWeeks: number; maxWeeks: number };
  serviceSlugs: string[];
  includes: string[];
  excludes: string[];
  guaranteeSlugs: string[];
  cta: { label: string; href: string };
}

export const offerPackages: OfferPackage[] = [
  {
    slug: "launch",
    name: "Launch",
    summary:
      "A fast, accessible marketing website that turns visitors into enquiries.",
    priceUSD: 500,
    timeline: { minWeeks: 4, maxWeeks: 8 },
    serviceSlugs: ["website-development"],
    includes: [
      "Discovery, information architecture, and a written fixed quote",
      "Responsive design for phone, tablet, and desktop",
      "Build on a modern framework with your content, or with copy we help structure",
      "On-page SEO, accessibility basics, analytics, and contact capture",
      "Deployment to production, repository access, and a written handover",
      "A 30-day defect-fix window after launch",
    ],
    excludes: [
      "Copywriting beyond structuring the content you provide",
      "Brand identity, logo design, and photography",
      "Paid advertising and ongoing SEO campaigns",
      "Third-party subscription and hosting fees",
    ],
    guaranteeSlugs: [
      "written-fixed-quote",
      "milestone-payments",
      "client-owns-code",
      "code-in-your-repository",
      "defect-fix-window",
    ],
    cta: { label: "Start with a free audit", href: "/website-audit" },
  },
  {
    slug: "growth",
    name: "Growth",
    summary:
      "A web application with real accounts, data, and workflows behind a login.",
    priceUSD: 1600,
    timeline: { minWeeks: 10, maxWeeks: 18 },
    serviceSlugs: ["web-applications"],
    includes: [
      "Product and workflow discovery, then a written fixed quote",
      "Frontend, backend, database, and integration work as one engagement",
      "Authentication, roles, dashboards, and the workflows in scope",
      "Automated tests for the critical paths, plus staging and production deployment",
      "Repository access from day one, documentation, and a written handover",
      "A 30-day defect-fix window after launch",
    ],
    excludes: [
      "Native iOS and Android applications",
      "Data migration from systems outside the agreed scope",
      "Third-party licence, cloud usage, and payment processor fees",
      "Custom machine-learning model training",
    ],
    guaranteeSlugs: [
      "written-fixed-quote",
      "milestone-payments",
      "client-owns-code",
      "code-in-your-repository",
      "no-lock-in",
      "defect-fix-window",
    ],
    cta: { label: "Book a free call", href: "/book-a-call" },
  },
  {
    slug: "scale",
    name: "Scale",
    summary:
      "A multi-tenant SaaS product, from architecture to billing and launch.",
    priceUSD: 2400,
    timeline: { minWeeks: 14, maxWeeks: 24 },
    serviceSlugs: ["saas-development"],
    includes: [
      "Product discovery, architecture, and a written fixed quote",
      "Multi-tenant foundations, onboarding, and subscription billing",
      "Admin tooling, usage metering, and the workflows in scope",
      "Deployed environments, automated tests, and monitoring setup",
      "Repository access from day one, documentation, and a written handover",
      "A 30-day defect-fix window after launch",
    ],
    excludes: [
      "Native mobile applications",
      "Legal, tax, and compliance certification",
      "Paid marketing, sales, and customer support staffing",
      "Third-party subscription, cloud, and payment processor fees",
    ],
    guaranteeSlugs: [
      "written-fixed-quote",
      "milestone-payments",
      "client-owns-code",
      "code-in-your-repository",
      "no-lock-in",
      "defect-fix-window",
    ],
    cta: { label: "Book a free call", href: "/book-a-call" },
  },
];

export interface DiscoverySprint {
  name: string;
  summary: string;
  priceUSD: number;
  durationDays: number;
  includes: string[];
  /** Credited against the chosen package, so the sprint is never wasted money. */
  creditNote: string;
}

export const discoverySprint: DiscoverySprint = {
  name: "Discovery Sprint",
  summary:
    "A paid, fixed-scope week that turns an uncertain idea into a costed plan you can approve or take elsewhere.",
  priceUSD: 500,
  durationDays: 5,
  includes: [
    "A working session to agree the problem, users, and success measures",
    "A scope document with deliverables, assumptions, and exclusions",
    "A written fixed quote for the first build phase",
    "An architecture and tooling recommendation with the trade-offs stated",
    "A realistic timeline with milestones and a payment schedule",
  ],
  creditNote:
    "If you proceed with a build within 30 days, the sprint fee is credited against the first milestone.",
};

export interface EntryOffer {
  key: "website-audit" | "strategy-call" | "starter-package";
  title: string;
  summary: string;
  priceLabel: string;
  href: string;
  cta: string;
}

/**
 * The three ways to start, in the order they appear on /pricing.
 *
 * Two are genuinely free and one is the smallest paid package, so a visitor
 * who is not ready to buy still leaves with a next step that costs nothing.
 */
export const entryOffers: EntryOffer[] = [
  {
    key: "website-audit",
    title: "Free website audit",
    summary:
      "The tool checks performance, SEO, accessibility, and best practices on any public URL, and you get the findings by email.",
    priceLabel: "Free",
    href: "/website-audit",
    cta: "Run the free audit",
  },
  {
    key: "strategy-call",
    title: "Free strategy call",
    summary:
      "A short call with the engineer who would do the work. Bring the problem and leave with a realistic next step, whether or not you hire us.",
    priceLabel: "Free",
    href: "/book-a-call",
    cta: "Book a free call",
  },
  {
    key: "starter-package",
    title: "Starter package",
    summary:
      "The smallest paid engagement: a fast marketing website from the published floor, with a written fixed quote before work begins.",
    priceLabel: "From $500",
    href: "#packages",
    cta: "See the Launch package",
  },
];
