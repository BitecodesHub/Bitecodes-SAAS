import type { OsmTagFilter } from "@/lib/prospecting/categories";

/**
 * The ideal customer profile (plan decision D7).
 *
 * Two kinds of buyer: (a) small and mid-sized service businesses in India and
 * Australia whose website is outdated, slow, or lacks booking and chat, buying
 * studio services; and (b) the same businesses buying the self-serve products
 * (AI chatbot, forms, booking).
 *
 * Read by lead scoring, prospect research, outreach drafting, and blog topic
 * selection, so every value here is data, never copy shown to visitors.
 * Owned by the leads-crm package after the foundation.
 *
 * `recommendedServices` must be real slugs from `src/data/services.ts`,
 * `recommendedProducts` real product routes, `prospectCategories` real ids
 * from `src/lib/prospecting/categories.ts`, and `industryPages` real slugs
 * from `src/data/industries.ts`; `icp.test.ts` enforces all four.
 */

export type IcpCountry = "IN" | "AU";

/** Self-serve products, by their public route. */
export type IcpProduct = "ai-chatbot" | "forms" | "booking";

/** Prospect enrichment tags (mirrors `ProspectTag` in the data layer). */
export type IcpProspectTag =
  | "no-website"
  | "website-down"
  | "not-mobile-friendly"
  | "slow-website"
  | "insecure-website"
  | "seo-gaps"
  | "accessibility-gaps"
  | "feature-upgrade";

export interface IcpSegment {
  id: string;
  name: string;
  /** "services" buys studio work; "self-serve" buys a product plan. */
  buyer: "services" | "self-serve";
  countries: IcpCountry[];
  /** Lowercase words and phrases that identify the segment in text. */
  industryKeywords: string[];
  /** Discovery map categories (ids in src/lib/prospecting/categories.ts). */
  prospectCategories: string[];
  /** Extra OpenStreetMap tags for segments the categories do not cover. */
  osmHints: OsmTagFilter[];
  /** Industry pages that already exist for this segment. */
  industryPages: string[];
  /** What tends to be wrong, in plain words, for research and outreach. */
  painSignals: string[];
  /** Enrichment tags that indicate a fit for this segment. */
  prospectTags: IcpProspectTag[];
  /** Service slugs from src/data/services.ts, best fit first. */
  recommendedServices: string[];
  recommendedProducts: IcpProduct[];
  /** Article ideas for the blog generator's topic clusters. */
  blogTopicSeeds: string[];
  /** Relative priority, 0 to 1, used to weight scores and topic rotation. */
  weight: number;
}

export const ICP_SEGMENTS: IcpSegment[] = [
  {
    id: "healthcare-allied-health",
    name: "Healthcare and allied health clinics",
    buyer: "services",
    countries: ["IN", "AU"],
    industryKeywords: [
      "clinic",
      "medical centre",
      "medical center",
      "general practice",
      "dentist",
      "dental",
      "physiotherapy",
      "physio",
      "chiropractor",
      "optometrist",
      "psychologist",
      "counselling",
      "podiatry",
      "speech therapy",
      "occupational therapy",
      "dietitian",
      "pathology",
      "diagnostic centre",
      "hospital",
    ],
    prospectCategories: ["health"],
    osmHints: [],
    industryPages: ["healthcare"],
    painSignals: [
      "No online appointment booking",
      "Patient intake forms are paper or PDF downloads",
      "Website is not usable on a phone",
      "Pages load slowly",
      "No answers outside opening hours",
    ],
    prospectTags: [
      "no-website",
      "not-mobile-friendly",
      "slow-website",
      "insecure-website",
      "feature-upgrade",
    ],
    recommendedServices: [
      "website-development",
      "ui-ux-development",
      "business-automation",
      "ai-integration",
      "maintenance-support",
    ],
    recommendedProducts: ["booking", "forms", "ai-chatbot"],
    blogTopicSeeds: [
      "How to add online appointment booking to a clinic website",
      "What patients look for on a clinic website before they book",
      "Moving patient intake forms online without losing the personal touch",
      "Reducing no-shows with automated appointment reminders",
    ],
    weight: 1,
  },
  {
    id: "ndis-aged-care",
    name: "NDIS, disability, and aged care providers",
    buyer: "services",
    countries: ["AU"],
    industryKeywords: [
      "ndis",
      "disability support",
      "support coordination",
      "plan management",
      "aged care",
      "home care",
      "in-home care",
      "respite",
      "community care",
      "chsp",
      "home care package",
      "supported independent living",
      "allied health",
    ],
    prospectCategories: ["health"],
    osmHints: [
      { key: "amenity", values: ["social_facility"] },
      {
        key: "social_facility",
        values: ["nursing_home", "assisted_living", "group_home", "outreach"],
      },
      { key: "healthcare", values: ["occupational_therapist", "nurse"] },
    ],
    industryPages: ["healthcare"],
    painSignals: [
      "Referral and intake forms arrive by email or fax",
      "Website is hard to use with assistive technology",
      "No clear way for participants or families to enquire",
      "Rostering and service agreements are managed in spreadsheets",
      "Website is not usable on a phone",
    ],
    prospectTags: [
      "accessibility-gaps",
      "not-mobile-friendly",
      "feature-upgrade",
      "no-website",
      "slow-website",
    ],
    recommendedServices: [
      "website-development",
      "business-automation",
      "custom-software",
      "ai-integration",
      "maintenance-support",
    ],
    recommendedProducts: ["forms", "booking", "ai-chatbot"],
    blogTopicSeeds: [
      "What participants and plan managers look for on an NDIS provider website",
      "Accessible website basics for disability and aged care providers",
      "Automating referrals, intake, and service agreements for small care providers",
      "Answering family enquiries after hours without adding staff",
    ],
    weight: 1,
  },
  {
    id: "education-training",
    name: "Education, coaching, and training providers",
    buyer: "services",
    countries: ["IN", "AU"],
    industryKeywords: [
      "coaching centre",
      "coaching center",
      "tuition",
      "academy",
      "institute",
      "training",
      "rto",
      "preschool",
      "childcare",
      "kindergarten",
      "language school",
      "music school",
      "driving school",
      "college",
      "school",
    ],
    prospectCategories: ["education"],
    osmHints: [],
    industryPages: ["education"],
    painSignals: [
      "Enrolment happens by phone or walk-in only",
      "Course and fee information is out of date",
      "Parents and students ask the same questions repeatedly",
      "No online class schedule or booking",
    ],
    prospectTags: [
      "feature-upgrade",
      "not-mobile-friendly",
      "seo-gaps",
      "no-website",
    ],
    recommendedServices: [
      "website-development",
      "web-applications",
      "mobile-app-development",
      "business-automation",
      "ai-integration",
    ],
    recommendedProducts: ["forms", "booking", "ai-chatbot"],
    blogTopicSeeds: [
      "Online enrolment for coaching centres: a practical guide",
      "Answering parent and student questions automatically with an AI assistant",
      "Course catalogue pages that rank and convert",
      "When a training provider needs a learning portal, and when it does not",
    ],
    weight: 0.9,
  },
  {
    id: "trades-construction",
    name: "Trades, construction, and home services",
    buyer: "services",
    countries: ["IN", "AU"],
    industryKeywords: [
      "builder",
      "construction",
      "contractor",
      "electrician",
      "plumber",
      "carpenter",
      "roofing",
      "renovation",
      "landscaping",
      "painter",
      "air conditioning",
      "hvac",
      "solar",
      "interior design",
      "cleaning services",
    ],
    prospectCategories: ["trades"],
    osmHints: [],
    industryPages: [],
    painSignals: [
      "No quote request form, only a phone number",
      "No photos of past jobs",
      "Website missing or a single social media page",
      "Not found in local search results",
    ],
    prospectTags: [
      "no-website",
      "seo-gaps",
      "not-mobile-friendly",
      "slow-website",
    ],
    recommendedServices: [
      "website-development",
      "business-automation",
      "performance-optimization",
      "maintenance-support",
    ],
    recommendedProducts: ["forms", "booking"],
    blogTopicSeeds: [
      "How tradespeople win more quote requests from their website",
      "Quote request forms that qualify jobs before you call back",
      "Showing past work online: a simple portfolio for trade businesses",
      "Local search basics for builders and contractors",
    ],
    weight: 0.8,
  },
  {
    id: "professional-services",
    name: "Professional services firms",
    buyer: "services",
    countries: ["IN", "AU"],
    industryKeywords: [
      "accountant",
      "chartered accountant",
      "tax agent",
      "bookkeeping",
      "lawyer",
      "law firm",
      "solicitor",
      "advocate",
      "consultant",
      "consultancy",
      "architect",
      "engineering consultancy",
      "financial adviser",
      "financial planner",
      "insurance broker",
      "mortgage broker",
      "migration agent",
      "real estate agency",
      "property management",
      "recruitment agency",
    ],
    prospectCategories: ["professional-services", "real-estate"],
    osmHints: [],
    industryPages: ["finance", "recruitment"],
    painSignals: [
      "Client intake is manual email and paperwork",
      "No online booking for consultations",
      "Website looks dated next to competitors",
      "Repetitive client questions take staff time",
    ],
    prospectTags: [
      "feature-upgrade",
      "slow-website",
      "seo-gaps",
      "insecure-website",
    ],
    recommendedServices: [
      "website-development",
      "custom-software",
      "business-automation",
      "ai-integration",
      "technical-consulting",
    ],
    recommendedProducts: ["booking", "forms", "ai-chatbot"],
    blogTopicSeeds: [
      "Client intake automation for accounting and law firms",
      "Should a professional services firm add an AI assistant to its website?",
      "Secure document collection for small firms: options compared",
      "Consultation booking pages that reduce back-and-forth email",
    ],
    weight: 0.9,
  },
  {
    id: "hospitality-retail",
    name: "Hospitality, retail, and wellness businesses",
    buyer: "services",
    countries: ["IN", "AU"],
    industryKeywords: [
      "restaurant",
      "cafe",
      "bakery",
      "catering",
      "hotel",
      "guest house",
      "homestay",
      "resort",
      "boutique",
      "retail store",
      "salon",
      "spa",
      "gym",
      "fitness studio",
      "yoga studio",
      "florist",
    ],
    prospectCategories: [
      "food-drink",
      "hospitality",
      "retail",
      "beauty-wellness",
      "fitness",
    ],
    osmHints: [],
    industryPages: ["retail"],
    painSignals: [
      "Bookings and orders go through third-party platforms that take a commission",
      "Menu, prices, or opening hours are out of date online",
      "No online booking for appointments or tables",
      "Website is slow or not usable on a phone",
    ],
    prospectTags: [
      "not-mobile-friendly",
      "slow-website",
      "no-website",
      "feature-upgrade",
    ],
    recommendedServices: [
      "website-development",
      "web-applications",
      "mobile-app-development",
      "performance-optimization",
      "ui-ux-development",
    ],
    recommendedProducts: ["booking", "ai-chatbot", "forms"],
    blogTopicSeeds: [
      "Direct bookings versus booking platforms for small hotels",
      "Online ordering for independent restaurants: build or subscribe?",
      "Appointment booking for salons and studios without double bookings",
      "Keeping menus, prices, and hours accurate across the web",
    ],
    weight: 0.7,
  },
  {
    id: "saas-self-serve",
    name: "Self-serve product buyers",
    buyer: "self-serve",
    countries: ["IN", "AU"],
    industryKeywords: [
      "chatbot",
      "live chat",
      "online booking",
      "appointment scheduling",
      "form builder",
      "online forms",
      "lead capture",
      "enquiry form",
    ],
    prospectCategories: [
      "health",
      "professional-services",
      "education",
      "beauty-wellness",
      "fitness",
      "trades",
    ],
    osmHints: [],
    industryPages: [],
    painSignals: [
      "No answers for visitors outside business hours",
      "Bookings are arranged by phone or email",
      "Enquiry form emails get lost or go unanswered",
      "Has a website but no budget for custom development",
    ],
    prospectTags: ["feature-upgrade"],
    recommendedServices: ["ai-integration", "business-automation"],
    recommendedProducts: ["ai-chatbot", "booking", "forms"],
    blogTopicSeeds: [
      "An AI chatbot for a small business website: what it can and cannot do",
      "Setting up an online booking page for a service business",
      "Embedding a form that sends enquiries where your team will see them",
    ],
    weight: 0.6,
  },
];

/** Signals that a lead or prospect is not a buyer. */
export interface IcpDisqualifier {
  id: string;
  label: string;
  /** Why it disqualifies, for the qualification note. */
  reason: string;
  /** Lowercase phrases matched against the lead's text or business type. */
  keywords: string[];
}

export const ICP_DISQUALIFIERS: IcpDisqualifier[] = [
  {
    id: "competitor",
    label: "Agency or software company",
    reason: "Sells the same services rather than buying them.",
    keywords: [
      "web design agency",
      "web development company",
      "digital agency",
      "software company",
      "it services",
      "app development company",
      "white label",
    ],
  },
  {
    id: "vendor-pitch",
    label: "Vendor pitch",
    reason: "Offers a service to Bitecodes rather than asking for one.",
    keywords: [
      "guest post",
      "backlinks",
      "link building",
      "seo services for your website",
      "outsourcing partner",
      "we can redesign your website",
      "lead generation services",
    ],
  },
  {
    id: "job-seeker",
    label: "Job or internship request",
    reason: "A hiring enquiry belongs with careers, not sales.",
    keywords: [
      "internship",
      "job application",
      "my resume",
      "my cv",
      "looking for a job",
      "hiring process",
    ],
  },
  {
    id: "academic",
    label: "Academic project",
    reason: "Coursework and student projects are out of scope.",
    keywords: [
      "college project",
      "final year project",
      "assignment",
      "homework",
      "thesis",
    ],
  },
  {
    id: "spam",
    label: "Spam",
    reason: "Unrelated or abusive content.",
    keywords: [
      "casino",
      "crypto investment",
      "forex signals",
      "loan offer",
      "adult content",
      "bitcoin doubling",
    ],
  },
];

/**
 * Free email providers. A business-domain address is a stronger buying
 * signal; a free-mail address is common for small businesses in India and
 * Australia, so it lowers a score rather than disqualifying.
 */
export const FREE_MAIL_DOMAINS: readonly string[] = [
  // Global
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "zoho.com",
  "zohomail.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "tutanota.com",
  "tuta.io",
  "fastmail.com",
  "hey.com",
  "qq.com",
  "163.com",
  "126.com",
  // India
  "yahoo.co.in",
  "yahoo.in",
  "rediffmail.com",
  "rediff.com",
  "outlook.in",
  "hotmail.co.in",
  "live.in",
  "zohomail.in",
  "indiatimes.com",
  "sify.com",
  "vsnl.net",
  "vsnl.com",
  "bsnl.in",
  // Australia
  "yahoo.com.au",
  "outlook.com.au",
  "hotmail.com.au",
  "live.com.au",
  "bigpond.com",
  "bigpond.com.au",
  "bigpond.net.au",
  "optusnet.com.au",
  "iinet.net.au",
  "tpg.com.au",
  "internode.on.net",
  "westnet.com.au",
  "ozemail.com.au",
  "dodo.com.au",
  "adam.com.au",
  "aapt.net.au",
  "exetel.com.au",
  "netspace.net.au",
  "people.net.au",
];

const FREE_MAIL_SET = new Set(FREE_MAIL_DOMAINS);

/** True when an email address (or bare domain) is a free-mail provider. */
export function isFreeMailDomain(emailOrDomain: string): boolean {
  const value = emailOrDomain.trim().toLowerCase();
  const domain = value.includes("@") ? value.split("@").pop() : value;
  return Boolean(domain && FREE_MAIL_SET.has(domain));
}

export function getIcpSegment(id: string): IcpSegment | undefined {
  return ICP_SEGMENTS.find((segment) => segment.id === id);
}

export interface IcpMatch {
  segment: IcpSegment;
  /** The keyword phrases that matched, longest first. */
  matches: string[];
}

/**
 * Finds the segment whose vocabulary best matches free text.
 *
 * Scores by the number of distinct phrases matched, then by the longest phrase
 * (a match on "ndis" is strong evidence; a match on "school" is weaker), then
 * by the segment's own weight. A single generic word is not enough: every
 * segment needs at least one phrase that is genuinely about what they do.
 */
export function matchIcpSegment(text: string): IcpMatch | null {
  const haystack = text.toLowerCase();
  let best: IcpMatch | null = null;
  let bestScore = 0;

  for (const segment of ICP_SEGMENTS) {
    const matches = segment.industryKeywords
      .filter((keyword) => haystack.includes(keyword))
      .sort((a, b) => b.length - a.length);
    if (matches.length === 0) continue;

    const longest = matches[0]?.length ?? 0;
    const score = matches.length * 100 + longest * 2 + segment.weight;
    if (score > bestScore) {
      bestScore = score;
      best = { segment, matches };
    }
  }

  return best;
}
