import type { AdminRole } from "@/lib/server/db/types";

/**
 * Role-based permissions.
 *
 * Pure and dependency-free so the whole permission matrix is unit-testable —
 * an authorisation rule that is only exercised by clicking through the UI is a
 * rule that will eventually be wrong without anyone noticing.
 *
 * Deliberately a small, flat set of capabilities rather than per-route checks:
 * a new admin page picks an existing capability instead of inventing a rule,
 * so there is one place to audit who can do what.
 */

export const CAPABILITIES = [
  /** Read the dashboard, leads, prospects, and reports. */
  "view",
  /** Change lead and prospect status, add notes, assign owners. */
  "manage_leads",
  /** Run map discovery and enrichment. */
  "manage_prospects",
  /** Draft and edit blog posts. */
  "write_content",
  /** Publish or unpublish content on the live site. */
  "publish_content",
  /** Approve queued outreach, edit templates and sequences. */
  "send_email",
  /** Change site settings, automation thresholds, AI configuration. */
  "manage_settings",
  /** Create, disable, and re-role admin accounts. */
  "manage_users",
  /** Retry, cancel, and inspect background jobs. */
  "manage_jobs",
  /** Create and configure AI chatbots and their API keys and models. */
  "manage_chatbots",
  /** Build embeddable forms and read their submissions. */
  "manage_forms",
  /** Configure booking pages, their availability, and the resulting diary. */
  "manage_bookings",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * Which capabilities each role holds.
 *
 * The distinction that matters most is `write_content` versus
 * `publish_content`: an editor can draft and revise freely, but pushing a page
 * live — where it reaches customers and search engines — needs an admin.
 * Likewise `send_email` is withheld from editors, because approving outreach
 * sends mail to real businesses in the company's name.
 */
const ROLE_CAPABILITIES: Record<AdminRole, readonly Capability[]> = {
  owner: CAPABILITIES,
  admin: [
    "view",
    "manage_leads",
    "manage_prospects",
    "write_content",
    "publish_content",
    "send_email",
    "manage_settings",
    "manage_jobs",
    "manage_chatbots",
    "manage_forms",
    "manage_bookings",
  ],
  editor: ["view", "manage_leads", "write_content"],
  viewer: ["view"],
};

export function can(role: AdminRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function capabilitiesFor(role: AdminRole): readonly Capability[] {
  return ROLE_CAPABILITIES[role] ?? [];
}

/** Ordered most to least privileged, for display and for role pickers. */
export const ROLE_ORDER: AdminRole[] = ["owner", "admin", "editor", "viewer"];

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  owner: "Full access, including admin accounts.",
  admin: "Everything except managing admin accounts.",
  editor: "Draft content and work leads. Cannot publish or send email.",
  viewer: "Read-only access.",
};
