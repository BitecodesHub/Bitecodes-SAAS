import type { LucideIcon } from "lucide-react";

/** A single service offering. */
export interface Service {
  slug: string;
  title: string;
  /** Short one-line value proposition for cards. */
  tagline: string;
  /** Longer paragraph for the detail section. */
  description: string;
  icon: LucideIcon;
  features: string[];
  /** Representative technologies for this service (tech slugs). */
  stack: string[];
  /** Optional grouping for the services overview. */
  category:
    | "Engineering"
    | "Product & Design"
    | "AI & Automation"
    | "Cloud & Operations";
}

/** A technology / tool the studio works with. */
export interface Technology {
  slug: string;
  name: string;
  category: "Languages" | "Frameworks" | "Databases" | "Cloud & DevOps" | "AI";
  description: string;
}

/** An industry vertical served. */
export interface Industry {
  slug: string;
  name: string;
  icon: LucideIcon;
  description: string;
  highlights: string[];
}

/** A step in the delivery process. */
export interface ProcessStep {
  step: number;
  title: string;
  icon: LucideIcon;
  description: string;
  deliverables: string[];
}

/** A client testimonial. */
export interface Testimonial {
  quote: string;
  role: string;
  company: string;
}

/** A headline statistic. */
export interface Stat {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
}

/** A featured client. */
export interface Client {
  slug: string;
  name: string;
  location: string;
  industry: string;
  summary: string;
}

/** A frequently asked question. */
export interface Faq {
  question: string;
  answer: string;
}

/** A portfolio case study. */
export interface Project {
  slug: string;
  name: string;
  client: string;
  category: string;
  year: string;
  /** Short teaser for the portfolio grid. */
  teaser: string;
  overview: string;
  challenge: string;
  solution: string;
  technologies: string[];
  features: string[];
  results: { metric: string; label: string }[];
  /** Accent gradient classes for the cover (Tailwind). */
  accent: string;
  featured?: boolean;
  /** Number of placeholder gallery frames to render. */
  gallery: number;
  liveUrl?: string;
}

/** A blog post (static content). */
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  author: string;
  date: string; // ISO
  readingMinutes: number;
  /** Body as ordered content blocks for simple static rendering. */
  body: { type: "h2" | "p" | "ul"; text?: string; items?: string[] }[];
  featured?: boolean;
}

/** An open role. */
export interface JobOpening {
  slug: string;
  title: string;
  department: string;
  type: string;
  location: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
}
