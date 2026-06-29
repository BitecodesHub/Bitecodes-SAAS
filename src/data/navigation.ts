import {
  AppWindow,
  BrainCircuit,
  Cloud,
  Code2,
  Compass,
  Layers,
  Newspaper,
  Rocket,
  Server,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLink {
  title: string;
  href: string;
  description?: string;
  icon?: LucideIcon;
}

export interface NavMenuSection {
  heading: string;
  links: NavLink[];
}

export interface NavItem {
  title: string;
  href: string;
  /** When present, renders as a mega-menu trigger. */
  sections?: NavMenuSection[];
  /** Optional highlighted promo column for the mega menu. */
  featured?: {
    title: string;
    description: string;
    href: string;
    cta: string;
  };
}

export const mainNav: NavItem[] = [
  {
    title: "Services",
    href: "/services",
    sections: [
      {
        heading: "Engineering",
        links: [
          {
            title: "Web Applications",
            href: "/services/web-applications",
            description: "Complex, data-rich products",
            icon: AppWindow,
          },
          {
            title: "Enterprise Software",
            href: "/services/enterprise-software",
            description: "Mission-critical systems",
            icon: Server,
          },
          {
            title: "SaaS Development",
            href: "/services/saas-development",
            description: "Multi-tenant platforms",
            icon: Layers,
          },
          {
            title: "REST API Development",
            href: "/services/rest-api-development",
            description: "Clean, documented APIs",
            icon: Code2,
          },
        ],
      },
      {
        heading: "AI, Cloud & Design",
        links: [
          {
            title: "AI Integration",
            href: "/services/ai-integration",
            description: "Practical AI in products",
            icon: BrainCircuit,
          },
          {
            title: "MCP Servers",
            href: "/services/mcp-servers",
            description: "Connect tools to AI",
            icon: Workflow,
          },
          {
            title: "Cloud Solutions",
            href: "/services/cloud-solutions",
            description: "AWS & Azure architecture",
            icon: Cloud,
          },
          {
            title: "UI/UX Development",
            href: "/services/ui-ux-development",
            description: "Design that ships",
            icon: Compass,
          },
        ],
      },
    ],
    featured: {
      title: "All services",
      description:
        "Nineteen ways we help teams design, build, and scale software.",
      href: "/services",
      cta: "Explore services",
    },
  },
  {
    title: "Work",
    href: "/portfolio",
    sections: [
      {
        heading: "Featured case studies",
        links: [
          {
            title: "PRISM",
            href: "/portfolio/prism",
            description: "AI-driven SEO platform",
            icon: BrainCircuit,
          },
          {
            title: "Smart AI Park",
            href: "/portfolio/smart-ai-park",
            description: "AI parking intelligence",
            icon: Rocket,
          },
          {
            title: "Bitecodes Academy",
            href: "/portfolio/bitecodes-academy",
            description: "Learning platform",
            icon: Users,
          },
          {
            title: "Sublime Care",
            href: "/portfolio/sublime-care",
            description: "Care-ops automation",
            icon: Workflow,
          },
        ],
      },
    ],
    featured: {
      title: "Full portfolio",
      description: "Ten case studies across healthcare, media, and AI.",
      href: "/portfolio",
      cta: "View all work",
    },
  },
  {
    title: "Company",
    href: "/about",
    sections: [
      {
        heading: "About Bitecodes",
        links: [
          {
            title: "About",
            href: "/about",
            description: "Story, mission & values",
            icon: Users,
          },
          {
            title: "Process",
            href: "/process",
            description: "How we deliver",
            icon: Workflow,
          },
          {
            title: "Technologies",
            href: "/technologies",
            description: "Our stack",
            icon: Code2,
          },
        ],
      },
      {
        heading: "More",
        links: [
          {
            title: "Industries",
            href: "/industries",
            description: "Who we serve",
            icon: Layers,
          },
          {
            title: "Careers",
            href: "/careers",
            description: "Join the team",
            icon: Rocket,
          },
          {
            title: "Blog",
            href: "/blog",
            description: "Notes & insights",
            icon: Newspaper,
          },
        ],
      },
    ],
  },
  {
    title: "Blog",
    href: "/blog",
  },
  {
    title: "Contact",
    href: "/contact",
  },
];

export interface FooterColumn {
  heading: string;
  links: { title: string; href: string }[];
}

export const footerNav: FooterColumn[] = [
  {
    heading: "Services",
    links: [
      { title: "Web Applications", href: "/services/web-applications" },
      { title: "Enterprise Software", href: "/services/enterprise-software" },
      { title: "SaaS Development", href: "/services/saas-development" },
      { title: "AI Integration", href: "/services/ai-integration" },
      { title: "All services", href: "/services" },
    ],
  },
  {
    heading: "Company",
    links: [
      { title: "About", href: "/about" },
      { title: "Portfolio", href: "/portfolio" },
      { title: "Process", href: "/process" },
      { title: "Technologies", href: "/technologies" },
      { title: "Industries", href: "/industries" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { title: "Pricing", href: "/pricing" },
      { title: "Blog", href: "/blog" },
      { title: "Careers", href: "/careers" },
      { title: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { title: "Privacy Policy", href: "/privacy" },
      { title: "Terms & Conditions", href: "/terms" },
      { title: "Cookie Policy", href: "/cookies" },
    ],
  },
];
