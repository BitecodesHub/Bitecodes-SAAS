import type { Stat } from "@/types/content";
import { projects } from "@/data/projects";
import { services } from "@/data/services";
import { siteConfig } from "@/lib/site";

/*
 * Every number on the site is derived from data. Counts describe only what is
 * published here: the founding year in siteConfig, project sites with a live
 * URL, the products with public pages, and the services we offer.
 */

/** Products with a public page and a working self-serve product. */
export const liveProducts = [
  { name: "AI Chatbot", href: "/ai-chatbot" },
  { name: "Notes", href: "/notes" },
  { name: "Forms", href: "/forms" },
  { name: "Booking", href: "/booking" },
] as const;

export const yearsSinceFounding = Math.max(
  0,
  new Date().getFullYear() - siteConfig.founded,
);

/** Client and related-party project sites that are publicly reachable. */
export const liveProjectSites = projects.filter(
  (project) => project.relationship !== "internal" && Boolean(project.liveUrl),
);

export const stats: Stat[] = [
  { label: "Years since founding", value: yearsSinceFounding },
  { label: "Projects with a live site", value: liveProjectSites.length },
  { label: "Products live", value: liveProducts.length },
  { label: "Services offered", value: services.length },
];
