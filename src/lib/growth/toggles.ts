/**
 * Growth automation switches: one list, shared by the settings resolver, the
 * scheduler registry, and the /admin/growth page.
 *
 * Client-safe on purpose (no server imports), so the admin form can render
 * labels and descriptions without pulling the database layer into the
 * browser bundle.
 *
 * Defaults follow one rule: an automation that only writes internal data or
 * emails the owner starts on; one that emails a prospect or customer starts
 * off until the owner switches it on. Booking reminders are the deliberate
 * exception, because the recipient asked for the booking.
 */

export type GrowthToggleGroup =
  | "AI"
  | "Leads and sales"
  | "Content and search"
  | "Customers"
  | "Reporting";

export interface GrowthToggle {
  key: string;
  label: string;
  description: string;
  group: GrowthToggleGroup;
  /** True when switching it on sends email to someone other than the owner. */
  sendsExternalEmail: boolean;
  defaultValue: boolean;
}

export const GROWTH_TOGGLES = [
  {
    key: "aiEnabled",
    label: "AI for automations",
    description:
      "Allows background automations to call the AI providers configured for the desktop app, in the same fallback order. When off, every AI step is skipped.",
    group: "AI",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "leadScoring",
    label: "Lead scoring",
    description:
      "Scores each new or changed lead against the ideal customer profile every day and adds a short qualification note.",
    group: "Leads and sales",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "prospectResearch",
    label: "Prospect research",
    description:
      "Writes a research brief for each newly enriched prospect from its website audit and public site facts.",
    group: "Leads and sales",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "outreachDrafts",
    label: "Outreach drafts",
    description:
      "Drafts a personalised first email for each qualified prospect. Drafts wait in the approval queue; nothing is sent without approval.",
    group: "Leads and sales",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "proposalFollowups",
    label: "Proposal follow-ups",
    description:
      "Reminds the owner about proposals that were viewed but not accepted, and expires proposals that are out of date.",
    group: "Leads and sales",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "chatSummaries",
    label: "Website chat review",
    description:
      "Summarises the website chats from the previous day, extracts leads, and lists questions the assistant could not answer.",
    group: "Leads and sales",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "callingAgent",
    label: "Callback calling agent",
    description:
      "Places an AI callback call only to people who requested one and gave consent. Requires telephony credentials.",
    group: "Leads and sales",
    sendsExternalEmail: false,
    defaultValue: false,
  },
  {
    key: "bookingReminders",
    label: "Booking reminders",
    description:
      "Emails a reminder 24 hours and 1 hour before a booked call to the person who booked it.",
    group: "Leads and sales",
    sendsExternalEmail: true,
    defaultValue: true,
  },
  {
    key: "analyticsRollup",
    label: "Analytics roll-up",
    description:
      "Aggregates the page views, events, traffic sources, and web vitals from the previous day into daily totals.",
    group: "Reporting",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "weeklyReport",
    label: "Weekly growth report",
    description:
      "Emails the owner a written summary of the traffic, leads, pipeline, and content of the past week every Monday.",
    group: "Reporting",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "searchPing",
    label: "Search engine ping",
    description:
      "Notifies search engines through IndexNow about pages that changed in the last day.",
    group: "Content and search",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "seoSelfAudit",
    label: "Weekly SEO self-audit",
    description:
      "Audits the key pages of this website every Sunday and reports any regression.",
    group: "Content and search",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "blogGenerate",
    label: "Blog drafts",
    description:
      "Drafts an article on Tuesdays and Fridays from the topics in the ideal customer profile, skipping topics already covered.",
    group: "Content and search",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "blogAutoPublish",
    label: "Publish blog drafts automatically",
    description:
      "Publishes generated articles immediately instead of holding them as drafts for review.",
    group: "Content and search",
    sendsExternalEmail: false,
    defaultValue: false,
  },
  {
    key: "socialDrafts",
    label: "Social post drafts",
    description:
      "Drafts LinkedIn posts from recent articles every Monday. Posts are never published automatically.",
    group: "Content and search",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "newsletterDrafts",
    label: "Newsletter drafts",
    description:
      "Drafts the weekly newsletter every Thursday for review. Nothing is sent without approval.",
    group: "Content and search",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "churnScan",
    label: "Churn risk scoring",
    description:
      "Scores every customer account for churn risk each day and lists the accounts that need attention.",
    group: "Customers",
    sendsExternalEmail: false,
    defaultValue: true,
  },
  {
    key: "winbackEmails",
    label: "Win-back emails",
    description:
      "Emails customers whose accounts are at high risk of churning with an offer of help.",
    group: "Customers",
    sendsExternalEmail: true,
    defaultValue: false,
  },
  {
    key: "lifecycleEmails",
    label: "Customer lifecycle emails",
    description:
      "Sends onboarding nudges, low-credit renewal reminders, and product suggestions to customers.",
    group: "Customers",
    sendsExternalEmail: true,
    defaultValue: false,
  },
  {
    key: "monthlyCustomerReports",
    label: "Monthly customer reports",
    description:
      "Emails each customer a summary of their usage and results on the first day of each month.",
    group: "Customers",
    sendsExternalEmail: true,
    defaultValue: false,
  },
  {
    key: "feedbackRequests",
    label: "Feedback requests",
    description:
      "Sends a short satisfaction survey to eligible customers every Wednesday and invites consenting promoters to leave a testimonial.",
    group: "Customers",
    sendsExternalEmail: true,
    defaultValue: false,
  },
] as const satisfies readonly GrowthToggle[];

export type GrowthToggleKey = (typeof GROWTH_TOGGLES)[number]["key"];

/** The resolved growth block: every switch, always a boolean. */
export type GrowthSettings = Record<GrowthToggleKey, boolean>;

export const GROWTH_TOGGLE_KEYS: GrowthToggleKey[] = GROWTH_TOGGLES.map(
  (toggle) => toggle.key,
);

export const GROWTH_DEFAULTS: GrowthSettings = Object.fromEntries(
  GROWTH_TOGGLES.map((toggle) => [toggle.key, toggle.defaultValue]),
) as GrowthSettings;

export function isGrowthToggleKey(value: string): value is GrowthToggleKey {
  return (GROWTH_TOGGLE_KEYS as string[]).includes(value);
}

export function getGrowthToggle(key: GrowthToggleKey): GrowthToggle {
  return GROWTH_TOGGLES.find((toggle) => toggle.key === key) as GrowthToggle;
}
