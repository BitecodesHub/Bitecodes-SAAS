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
  /**
   * Send mail through the account's own email credits, and buy more.
   *
   * Separate from `manage_settings`, which configures the *platform's* own
   * sending — templates, suppression, sequences. A self-serve customer must be
   * able to top up the email product they pay for without being handed the
   * controls for our outreach machinery.
   */
  "manage_email",
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
    "manage_email",
  ],
  editor: ["view", "manage_leads", "write_content"],
  viewer: ["view"],
  /**
   * A self-serve customer: the four products they pay for, and nothing else.
   *
   * The omission that does the work is `view`. It gates the admin dashboard,
   * and with it the leads, prospects and reports of the business itself — so a
   * customer who types `/admin` is refused by the same rule that refuses a
   * viewer who types `/admin/users`, rather than by a special case somebody has
   * to remember to write. `manage_settings` is withheld for the same reason: it
   * opens the AI model catalogue, which holds provider API keys.
   *
   * Everything a customer can reach is already scoped by `ownerId` in the query
   * itself, so holding these capabilities grants access to their own records
   * only, never to another customer's.
   */
  customer: [
    "manage_chatbots",
    "manage_forms",
    "manage_bookings",
    "manage_email",
  ],
};

/** True when the role is a self-serve customer rather than a member of staff. */
export function isCustomerRole(role: AdminRole): boolean {
  return role === "customer";
}

export function can(role: AdminRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function capabilitiesFor(role: AdminRole): readonly Capability[] {
  return ROLE_CAPABILITIES[role] ?? [];
}

/**
 * Staff roles, most to least privileged, for display and for role pickers.
 *
 * `customer` is deliberately absent: it is not a role anybody is *assigned* on
 * the team page, it is what signing yourself up makes you. Listing it there
 * would offer an owner a way to demote a colleague into a customer account, and
 * to promote a paying customer into staff, neither of which is a thing to do by
 * accident from a dropdown.
 */
export const ROLE_ORDER: AdminRole[] = ["owner", "admin", "editor", "viewer"];

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
  customer: "Customer",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  owner: "Full access, including admin accounts.",
  admin: "Everything except managing admin accounts.",
  editor: "Draft content and work leads. Cannot publish or send email.",
  viewer: "Read-only access.",
  customer:
    "Self-serve account. Their own chatbots, forms, and calendars only.",
};
