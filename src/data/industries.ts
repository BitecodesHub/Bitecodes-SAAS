import {
  Banknote,
  Building2,
  Clapperboard,
  Factory,
  GraduationCap,
  HeartPulse,
  Rocket,
  ShoppingBag,
  UserSearch,
} from "lucide-react";
import type { Industry } from "@/types/content";

export const industries: Industry[] = [
  {
    slug: "healthcare",
    name: "Healthcare",
    icon: HeartPulse,
    description:
      "Care platforms, patient tooling, and compliant data workflows for providers and aged-care operators.",
    highlights: ["Care management", "Patient portals", "Compliance-aware data"],
  },
  {
    slug: "education",
    name: "Education",
    icon: GraduationCap,
    description:
      "Learning platforms, course delivery, and assessment tools that scale to thousands of learners.",
    highlights: ["Learning platforms", "Assessments", "Cohort analytics"],
  },
  {
    slug: "recruitment",
    name: "Recruitment",
    icon: UserSearch,
    description:
      "Hiring platforms and candidate workflows that match the right people to the right roles, faster.",
    highlights: ["Applicant tracking", "Candidate matching", "Pipelines"],
  },
  {
    slug: "finance",
    name: "Finance",
    icon: Banknote,
    description:
      "Secure, auditable financial tooling — billing, reconciliation, and reporting built on solid data.",
    highlights: ["Billing & invoicing", "Reporting", "Audit trails"],
  },
  {
    slug: "retail",
    name: "Retail",
    icon: ShoppingBag,
    description:
      "Commerce experiences and back-office tooling that keep storefronts fast and operations smooth.",
    highlights: ["Storefronts", "Inventory", "Order workflows"],
  },
  {
    slug: "media",
    name: "Media",
    icon: Clapperboard,
    description:
      "Production, portfolio, and content platforms for studios and media houses that demand visual polish.",
    highlights: ["Content platforms", "Portfolios", "Media delivery"],
  },
  {
    slug: "manufacturing",
    name: "Manufacturing",
    icon: Factory,
    description:
      "Operational systems — tracking, scheduling, and reporting — that bring visibility to the floor.",
    highlights: ["Process tracking", "Scheduling", "Dashboards"],
  },
  {
    slug: "startups",
    name: "Startups",
    icon: Rocket,
    description:
      "From MVP to scale: pragmatic engineering that ships fast without painting you into a corner.",
    highlights: ["MVPs", "Rapid iteration", "Scale-ready foundations"],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    icon: Building2,
    description:
      "Large-scale platforms with the security, integration, and reliability enterprises require.",
    highlights: ["Integrations", "SSO & RBAC", "High availability"],
  },
];
