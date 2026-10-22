/**
 * Launch templates.
 *
 * These are starting points, not downloadable themes: each preview is a real
 * design direction that can be adapted to a client's content and built as part
 * of a Launch engagement. The copy is honest about that distinction because
 * "free template" would be a promise the product does not make.
 */

export type TemplateIcon = "calendar" | "menu" | "chart";

export interface TemplateStat {
  value: string;
  label: string;
}

export interface TemplateFeature {
  icon: TemplateIcon;
  title: string;
  description: string;
}

export interface LaunchTemplate {
  slug: string;
  name: string;
  industry: string;
  tagline: string;
  description: string;
  metaDescription: string;
  updated: string;
  palette: {
    bg: string;
    surface: string;
    ink: string;
    muted: string;
    accent: string;
    accentInk: string;
    accentSoft: string;
    border: string;
  };
  nav: string[];
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    primaryCta: string;
    secondaryCta: string;
    stats: TemplateStat[];
  };
  features: TemplateFeature[];
  testimonial: {
    quote: string;
    name: string;
    role: string;
  };
  finalCta: {
    heading: string;
    body: string;
    button: string;
  };
  bestFor: string[];
  included: string[];
}

export const launchTemplates: LaunchTemplate[] = [
  {
    slug: "harbour-clinic",
    name: "Harbour Clinic",
    industry: "Healthcare",
    tagline: "A calm, appointment-first site for a modern clinic.",
    description:
      "A quiet, trustworthy layout built around one action: booking an appointment. Soft sea-glass accents, generous spacing, and a structure that answers a patient's real questions before they call.",
    metaDescription:
      "Preview Harbour Clinic, a calm healthcare website template with online booking, service clarity, and patient-first structure from Bitecodes.",
    updated: "2026-10-22",
    palette: {
      bg: "#f7faf9",
      surface: "#ffffff",
      ink: "#10201d",
      muted: "#5c6f6a",
      accent: "#0f766e",
      accentInk: "#ffffff",
      accentSoft: "#e3f2ef",
      border: "#dbe7e4",
    },
    nav: ["Services", "Our team", "Patients", "Contact"],
    hero: {
      eyebrow: "Accepting new patients",
      headline: "Care that fits around your life.",
      subhead:
        "Same-week appointments with a team that explains every step. Book online in under a minute, or call and speak to a person.",
      primaryCta: "Book an appointment",
      secondaryCta: "See our services",
      stats: [
        { value: "< 48h", label: "Typical wait" },
        { value: "4.9/5", label: "Patient rating" },
        { value: "12 yrs", label: "In the community" },
      ],
    },
    features: [
      {
        icon: "calendar",
        title: "Booking that works",
        description:
          "Real availability, instant confirmation, and reminders that reduce missed appointments.",
      },
      {
        icon: "menu",
        title: "Clear services",
        description:
          "Every treatment explained in plain language, with what to expect and what it costs.",
      },
      {
        icon: "chart",
        title: "A team you know",
        description:
          "Faces, specialisms, and availability — so patients arrive already knowing who they will see.",
      },
    ],
    testimonial: {
      quote:
        "I booked on a Sunday evening and had a confirmation before I closed the laptop. The visit was just as straightforward.",
      name: "Amara P.",
      role: "Patient since 2022",
    },
    finalCta: {
      heading: "Your first appointment is the hardest step.",
      body: "We make the rest simple. Choose a time that suits you and we will take it from there.",
      button: "Book an appointment",
    },
    bestFor: [
      "Private clinics, dental practices, and specialist consultancies",
      "Teams that want online booking without a heavy patient portal",
      "Practices that need to explain services and pricing clearly",
    ],
    included: [
      "Customised brand, content, and imagery",
      "Appointment booking with confirmations and reminders",
      "Service and team pages with a clear content model",
      "Local SEO, structured data, accessibility, and analytics",
      "Deployment, repository access, and a written handover",
    ],
  },
  {
    slug: "ember-table",
    name: "Ember Table",
    industry: "Hospitality",
    tagline: "A warm, reservation-led site for a restaurant with character.",
    description:
      "An appetite-first layout with warm terracotta tones, a menu that reads beautifully on a phone, and a reservation action always within reach. Designed for independent restaurants rather than chains.",
    metaDescription:
      "Preview Ember Table, a warm restaurant website template with menus, reservations, and a mobile-first layout from Bitecodes.",
    updated: "2026-10-22",
    palette: {
      bg: "#fbf7f3",
      surface: "#ffffff",
      ink: "#241811",
      muted: "#75645a",
      accent: "#b04a2f",
      accentInk: "#ffffff",
      accentSoft: "#f8e7df",
      border: "#eadcd3",
    },
    nav: ["Menu", "Our story", "Private dining", "Visit"],
    hero: {
      eyebrow: "Dinner, Tuesday to Sunday",
      headline: "Food worth staying for.",
      subhead:
        "A short menu that changes with the season, cooked over fire, and served in a room that feels like it has been here for years.",
      primaryCta: "Reserve a table",
      secondaryCta: "Read the menu",
      stats: [
        { value: "18", label: "Seats" },
        { value: "5", label: "Nights a week" },
        { value: "2021", label: "Open since" },
      ],
    },
    features: [
      {
        icon: "menu",
        title: "A menu that reads well",
        description:
          "Seasonal dishes with allergens and prices, updated without a developer.",
      },
      {
        icon: "calendar",
        title: "Reservations, handled",
        description:
          "Real availability, party-size rules, and confirmations that reach the guest.",
      },
      {
        icon: "chart",
        title: "A room with a story",
        description:
          "Photography, people, and provenance — the reasons guests choose you over a chain.",
      },
    ],
    testimonial: {
      quote:
        "We opened with a full book for the first month. Guests kept mentioning how easy the website was, which is not something I expected.",
      name: "Jonah R.",
      role: "Owner, Ember Table",
    },
    finalCta: {
      heading: "The table is set.",
      body: "Reserve online for dinner, or call us for a larger party. We will confirm by email.",
      button: "Reserve a table",
    },
    bestFor: [
      "Independent restaurants and wine bars",
      "Venues with a seasonal menu and a reservation book",
      "Owners who want to update menus without a developer",
    ],
    included: [
      "Customised brand, photography direction, and content",
      "Menu management with allergens and seasonal updates",
      "Reservation flow with confirmations",
      "Local SEO, structured data, accessibility, and analytics",
      "Deployment, repository access, and a written handover",
    ],
  },
  {
    slug: "northwind",
    name: "Northwind",
    industry: "SaaS",
    tagline:
      "A crisp product site that explains the software and earns the trial.",
    description:
      "A product-led layout with a clear value proposition, a real workflow illustration, proof, and one primary trial action. Restrained indigo, tight typography, and no decorative noise.",
    metaDescription:
      "Preview Northwind, a crisp SaaS website template built around product clarity, proof, and a single trial action from Bitecodes.",
    updated: "2026-10-22",
    palette: {
      bg: "#f7f8fc",
      surface: "#ffffff",
      ink: "#14162b",
      muted: "#5e647e",
      accent: "#4338ca",
      accentInk: "#ffffff",
      accentSoft: "#ecebff",
      border: "#e0e2ef",
    },
    nav: ["Product", "Pricing", "Customers", "Docs"],
    hero: {
      eyebrow: "Now in open beta",
      headline: "Every workflow, finally in one place.",
      subhead:
        "Northwind connects the tools your team already uses, then shows you what is actually blocking delivery — without another weekly status meeting.",
      primaryCta: "Start a free trial",
      secondaryCta: "See how it works",
      stats: [
        { value: "14 days", label: "Free trial" },
        { value: "No card", label: "To start" },
        { value: "SOC 2", label: "Aligned" },
      ],
    },
    features: [
      {
        icon: "chart",
        title: "One source of truth",
        description:
          "Projects, owners, and blockers in a single view that stays current.",
      },
      {
        icon: "calendar",
        title: "Fewer status meetings",
        description:
          "Automatic summaries replace the meeting nobody wanted to attend.",
      },
      {
        icon: "menu",
        title: "Works with your stack",
        description:
          "Connect the tools you already use; keep the data where it belongs.",
      },
    ],
    testimonial: {
      quote:
        "We replaced three spreadsheets and a weekly call. The team noticed within a week, which is the fastest adoption we have had.",
      name: "Priya N.",
      role: "Head of Delivery, Arclight",
    },
    finalCta: {
      heading: "Start with one workflow.",
      body: "Connect a project and see the difference in a week. No card, no sales call, cancel any time.",
      button: "Start a free trial",
    },
    bestFor: [
      "Early-stage SaaS products with a clear first workflow",
      "Product-led teams that want a trial rather than a demo request",
      "Companies that need pricing, docs, and trust signals in one place",
    ],
    included: [
      "Customised brand, product copy, and UI illustrations",
      "Trial signup or demo flow wired to your product or CRM",
      "Pricing, customer stories, and documentation structure",
      "Technical SEO, structured data, accessibility, and analytics",
      "Deployment, repository access, and a written handover",
    ],
  },
];

export function getTemplate(slug: string) {
  return launchTemplates.find((template) => template.slug === slug);
}

export function relatedTemplates(slug: string) {
  return launchTemplates.filter((template) => template.slug !== slug);
}
