import type { Capability } from "@/lib/server/auth/roles";

/**
 * Admin navigation.
 *
 * One declaration of the panel's structure, so the sidebar, the command
 * palette, and the breadcrumb trail cannot drift apart.
 *
 * Each entry names the capability required to see it. Hiding a link is a
 * convenience, never the protection — the page itself calls
 * `requireCapability`, because a URL typed directly must be refused just as
 * firmly as one that was never rendered.
 *
 * `enabled: false` marks a section that is planned but not yet built. It renders
 * as a labelled, non-clickable row rather than a link to a 404, so the sidebar
 * describes the panel honestly while it is being filled in.
 */

export interface AdminNavItem {
  label: string;
  href: string;
  /** Lucide icon name, resolved in the sidebar component. */
  icon: string;
  capability: Capability;
  enabled: boolean;
  description: string;
  /** Matched as a prefix, so child routes highlight their parent. */
  matchPrefix?: boolean;
}

export interface AdminNavSection {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        icon: "LayoutDashboard",
        capability: "view",
        enabled: true,
        description: "Key numbers, activity, and system health",
      },
    ],
  },
  {
    title: "Pipeline",
    items: [
      {
        label: "Leads",
        href: "/admin/leads",
        icon: "Inbox",
        capability: "manage_leads",
        enabled: true,
        description: "Enquiries, quotes, and audit requests",
        matchPrefix: true,
      },
      {
        label: "Customers",
        href: "/admin/customers",
        icon: "Users",
        capability: "manage_prospects",
        enabled: true,
        description: "Prospects discovered on the map",
        matchPrefix: true,
      },
      {
        label: "Grab new customers",
        href: "/admin/customers/discover",
        icon: "MapPin",
        capability: "manage_prospects",
        enabled: true,
        description: "Find businesses in an area and classify them",
      },
    ],
  },
  {
    title: "Outreach",
    items: [
      {
        label: "Email",
        href: "/admin/email",
        icon: "Mail",
        capability: "send_email",
        enabled: true,
        description: "Templates, sequences, and the approval queue",
        matchPrefix: true,
      },
      {
        label: "Chat",
        href: "/admin/chat",
        icon: "MessagesSquare",
        capability: "view",
        enabled: false,
        description: "Chatbot conversations and knowledge base",
        matchPrefix: true,
      },
    ],
  },
  {
    title: "Content",
    items: [
      {
        label: "Blog",
        href: "/admin/blog",
        icon: "PenLine",
        capability: "write_content",
        enabled: true,
        description: "Write and publish, with AI assistance",
        matchPrefix: true,
      },
      {
        label: "SEO",
        href: "/admin/seo",
        icon: "Search",
        capability: "view",
        enabled: false,
        description: "Coverage, links, and search-engine submission",
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Analytics",
        href: "/admin/analytics",
        icon: "BarChart3",
        capability: "view",
        enabled: false,
        description: "Traffic, conversions, and web vitals",
      },
      {
        label: "Jobs",
        href: "/admin/jobs",
        icon: "ListChecks",
        capability: "manage_jobs",
        enabled: false,
        description: "Background queue and failures",
      },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: "Settings",
        capability: "manage_settings",
        enabled: true,
        description: "Contact details, sending limits, and automation",
      },
      {
        label: "Team",
        href: "/admin/users",
        icon: "ShieldCheck",
        capability: "manage_users",
        enabled: true,
        description: "Hire employees and set their access",
      },
    ],
  },
];

/** Flattened, for the command palette and breadcrumbs. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap(
  (section) => section.items,
);

/**
 * Finds the navigation entry a pathname belongs to.
 *
 * Longest match wins, so `/admin/customers/discover` resolves to its own entry
 * rather than to `/admin/customers`, and the exact-match-only `/admin` does not
 * claim every path beneath it.
 */
export function findActiveNavItem(pathname: string): AdminNavItem | null {
  let best: AdminNavItem | null = null;

  for (const item of ADMIN_NAV_ITEMS) {
    const matches =
      item.href === pathname ||
      (item.matchPrefix === true && pathname.startsWith(`${item.href}/`));
    if (!matches) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }

  return best;
}
