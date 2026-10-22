import "server-only";

import type { ResolvedSettings } from "@/lib/server/settings";

/**
 * What this deployment can actually do, and exactly what is stopping it.
 *
 * The site is designed to boot with only MongoDB configured: public pages,
 * analytics, discovery and draft generation keep working while email, AI,
 * payments and search pings degrade to an explicit, visible state. This module
 * is the single answer to "which of those am I allowed to promise?" — used by
 * `/api/health`, the admin health panel, and the bootstrap report.
 *
 * States mean:
 *   enabled  — configured and switched on.
 *   manual   — the work happens, but only after a human action (approval,
 *              marking a reply, granting credits).
 *   degraded — configured and switched on, but a dependency is missing; the
 *              remaining parts keep running.
 *   disabled — switched off, or a required dependency is absent.
 *
 * Details never contain a secret value; they name the variable or setting to
 * change and nothing more.
 */

export type CapabilityState = "enabled" | "manual" | "disabled" | "degraded";

export interface Capability {
  id: string;
  label: string;
  state: CapabilityState;
  detail: string;
  remedy?: string;
}

export type OutboundSendGateState = "closed" | "manual" | "open";

export interface OutboundSendGate {
  state: OutboundSendGateState;
  /** True when a human could approve a commercial send right now. */
  canSend: boolean;
  reasons: string[];
  remedies: string[];
}

type Env = Record<string, string | undefined>;

function present(env: Env, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function secret(env: Env, key: string, minimum: number): boolean {
  return (env[key]?.trim().length ?? 0) >= minimum;
}

export function smtpConfigured(env: Env = process.env): boolean {
  return (
    present(env, "SMTP_HOST") &&
    present(env, "SMTP_FROM") &&
    present(env, "SMTP_USER") &&
    present(env, "SMTP_PASSWORD")
  );
}

export function aiConfigured(env: Env = process.env): boolean {
  return present(env, "AI_API_KEY") || present(env, "OPENROUTER_API_KEY");
}

export function razorpayConfigured(env: Env = process.env): boolean {
  return (
    present(env, "RAZORPAY_KEY_ID") &&
    present(env, "RAZORPAY_KEY_SECRET") &&
    present(env, "RAZORPAY_WEBHOOK_SECRET")
  );
}

export function imapConfigured(env: Env = process.env): boolean {
  return (
    present(env, "IMAP_HOST") &&
    present(env, "IMAP_USER") &&
    present(env, "IMAP_PASSWORD")
  );
}

/**
 * Whether commercial email may leave the server, and why not.
 *
 * Two independent conditions:
 *
 * 1. Infrastructure and law — SMTP credentials, a sender identity, and a
 *    postal address in the footer. Missing any one closes the gate completely:
 *    no draft, approval, or toggle can force a send through it.
 * 2. Policy — `automation.requireApproval`. When it is on the gate is
 *    `manual`, not closed: a person can release a message, which is the
 *    documented default.
 *
 * A gate of `open` does not mean every automation will send; each growth
 * toggle and each recipient's suppression/consent state is still checked at
 * send time. It means nothing structural is holding the pipeline.
 */
export function outboundSendGate(
  settings: ResolvedSettings,
  env: Env = process.env,
): OutboundSendGate {
  const reasons: string[] = [];
  const remedies: string[] = [];

  if (!smtpConfigured(env)) {
    const missing = [
      !present(env, "SMTP_HOST") && "SMTP_HOST",
      !present(env, "SMTP_FROM") && "SMTP_FROM",
      !present(env, "SMTP_USER") && "SMTP_USER",
      !present(env, "SMTP_PASSWORD") && "SMTP_PASSWORD",
    ].filter(Boolean);
    reasons.push(`SMTP is incomplete (${missing.join(", ")}).`);
    remedies.push("Set the missing SMTP_* variables and restart.");
  }

  if (!settings.outreach.fromAddress) {
    reasons.push("No outreach sender address is configured.");
    remedies.push("Set OUTREACH_FROM (a subdomain with SPF/DKIM is best).");
  }

  if (!settings.contact.address.postal) {
    reasons.push("No postal address is set for the commercial email footer.");
    remedies.push(
      "Set OUTREACH_POSTAL_ADDRESS or the postal address under Settings → Contact.",
    );
  }

  if (reasons.length > 0) {
    return { state: "closed", canSend: false, reasons, remedies };
  }

  if (settings.automation.requireApproval) {
    return {
      state: "manual",
      canSend: true,
      reasons: [
        "Every commercial email is held for human approval (automation.requireApproval is on).",
      ],
      remedies: [
        "Release drafts from the approval queue, or turn approval off under Settings → Automation once the templates are trusted.",
      ],
    };
  }

  return { state: "open", canSend: true, reasons: [], remedies: [] };
}

export interface CapabilityInput {
  settings: ResolvedSettings;
  env?: Env;
}

/**
 * The full matrix. Ordered roughly by how early a new deployment needs each
 * capability, so an operator reading top to bottom fixes blockers first.
 */
export function capabilityMatrix({
  settings,
  env = process.env,
}: CapabilityInput): Capability[] {
  const database = present(env, "MONGODB_URI");
  const ai = aiConfigured(env);
  const aiEnabled = settings.growth.aiEnabled;
  const aiUsable = ai && aiEnabled;
  const gate = outboundSendGate(settings, env);
  const smtp = smtpConfigured(env);
  const indexNow = secret(env, "INDEXNOW_KEY", 8);
  const razorpay = razorpayConfigured(env);
  const googleSignIn =
    present(env, "GOOGLE_CLIENT_ID") && present(env, "GOOGLE_CLIENT_SECRET");
  const cron = secret(env, "CRON_SECRET", 16);
  const signing = secret(env, "AUTH_SECRET", 32);

  const capabilities: Capability[] = [
    {
      id: "public-site",
      label: "Public website",
      state: "enabled",
      detail:
        "Pages, blog, sitemap, robots, feeds, and first-party analytics render from code and need no optional provider.",
    },
    {
      id: "database",
      label: "Database",
      state: database ? "enabled" : "disabled",
      detail: database
        ? "MONGODB_URI is set; live connectivity is checked separately."
        : "MONGODB_URI is not set, so only fully static output can be served.",
      remedy: database
        ? undefined
        : "Set MONGODB_URI and add this deployment's egress IP to the Atlas access list.",
    },
    {
      id: "signed-links",
      label: "Accounts and signed links",
      state: signing ? "enabled" : "disabled",
      detail: signing
        ? "AUTH_SECRET is set; admin sessions, unsubscribe links, portal links, and report links can be signed."
        : "AUTH_SECRET is missing or shorter than 32 characters, so sign-in and every signed link fail.",
      remedy: signing
        ? undefined
        : "Generate one with: openssl rand -base64 32",
    },
    {
      id: "scheduled-jobs",
      label: "Scheduled automation",
      state: cron ? "enabled" : "disabled",
      detail: cron
        ? "The heartbeat can authenticate; recurring jobs will run when the external cron calls /api/cron/run."
        : "CRON_SECRET is missing or shorter than 16 characters, so the scheduler refuses to run rather than run unauthenticated.",
      remedy: cron
        ? undefined
        : "Generate one with: openssl rand -hex 16 and point your scheduler at /api/cron/run.",
    },
    {
      id: "transactional-email",
      label: "Transactional email",
      state: smtp ? "enabled" : "disabled",
      detail: smtp
        ? "SMTP is configured. Enquiry acknowledgements, owner notifications, and booking mail can send."
        : "SMTP is incomplete, so enquiry acknowledgements and owner notifications cannot send.",
      remedy: smtp
        ? undefined
        : "Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.",
    },
    {
      id: "ai",
      label: "AI automation",
      state: !aiEnabled ? "disabled" : ai ? "enabled" : "disabled",
      detail: !aiEnabled
        ? "AI automation is switched off in Growth settings; every AI step is skipped."
        : ai
          ? "An AI provider key is set. Provider health is checked separately."
          : "No AI provider key is set. Pages, discovery, and audits continue; AI steps are skipped without pretending to succeed.",
      remedy: !aiEnabled
        ? "Turn on “AI for automations” under Admin → Growth."
        : ai
          ? undefined
          : "Set AI_API_KEY (and AI_BASE_URL/AI_MODEL for a non-OpenRouter provider).",
    },
    {
      id: "prospect-discovery",
      label: "Prospect discovery",
      state: database ? "enabled" : "disabled",
      detail: present(env, "GOOGLE_PLACES_API_KEY")
        ? "OpenStreetMap (default) and Google Places (opt-in) are available; discovery needs no further setup."
        : "OpenStreetMap is the discovery provider; no key is required.",
      remedy: database
        ? undefined
        : "Discovery stores rows in MongoDB, so MONGODB_URI must be set.",
    },
    {
      id: "outreach-drafts",
      label: "Outreach drafting",
      state: !settings.growth.outreachDrafts
        ? "disabled"
        : aiUsable
          ? "enabled"
          : "degraded",
      detail: !settings.growth.outreachDrafts
        ? "Drafting is switched off in Growth settings."
        : aiUsable
          ? "Qualified prospects get a personalised draft in the approval queue."
          : "Drafting needs an AI provider. Discovery, enrichment, auditing, and scoring continue without it.",
      remedy: !settings.growth.outreachDrafts
        ? "Turn on “Outreach drafts” under Admin → Growth."
        : aiUsable
          ? undefined
          : "Set AI_API_KEY to produce drafts, or write them manually from a prospect record.",
    },
    {
      id: "outbound-sending",
      label: "Commercial email sending",
      state:
        gate.state === "open"
          ? "enabled"
          : gate.state === "manual"
            ? "manual"
            : "disabled",
      detail:
        gate.state === "open"
          ? "Infrastructure and compliance checks are satisfied; per-automation toggles and recipient rules still apply."
          : gate.reasons.join(" "),
      remedy: gate.remedies[0],
    },
    {
      id: "payments",
      label: "Online payments",
      state: razorpay ? "enabled" : "manual",
      detail: razorpay
        ? "Razorpay checkout is configured."
        : "No Razorpay credentials: orders are still reserved and tracked, and an owner grants credits manually after direct payment.",
      remedy: razorpay
        ? undefined
        : "Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET to enable live checkout.",
    },
    {
      id: "search-indexing",
      label: "Search indexing",
      state: "enabled",
      detail:
        "The sitemap, robots rules, and canonical metadata are served without any external account.",
    },
    {
      id: "search-pings",
      label: "Search engine pings",
      state: indexNow ? "enabled" : "disabled",
      detail: indexNow
        ? "IndexNow submissions are enabled for changed pages."
        : "INDEXNOW_KEY is not set, so changed pages are not pushed to Bing or Yandex. Indexing itself is never claimed.",
      remedy: indexNow
        ? undefined
        : "Generate an 8–128 character key, set INDEXNOW_KEY, and serve it at /<key>.txt.",
    },
    {
      id: "reply-detection",
      label: "Reply detection",
      state: imapConfigured(env) ? "enabled" : "manual",
      detail: imapConfigured(env)
        ? "IMAP polling is configured; sequences stop when a recipient replies."
        : "IMAP is not configured. Replies must be marked by hand so sequences stop.",
      remedy: imapConfigured(env)
        ? undefined
        : "Set IMAP_HOST, IMAP_PORT, IMAP_USER, and IMAP_PASSWORD.",
    },
    {
      id: "google-signin",
      label: "Google sign-in",
      state: googleSignIn ? "enabled" : "disabled",
      detail: googleSignIn
        ? "Continue with Google is offered on the sign-in pages."
        : "Google sign-in is hidden because no OAuth client is configured; email and password still work.",
      remedy: googleSignIn
        ? undefined
        : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then register the exact callback URLs.",
    },
    {
      id: "website-chat",
      label: "Website chat",
      state: !settings.ai.chatEnabled
        ? "disabled"
        : aiUsable
          ? "enabled"
          : "degraded",
      detail: !settings.ai.chatEnabled
        ? "The website chat is switched off in settings."
        : aiUsable
          ? "The chat assistant can answer from the knowledge base."
          : "The chat widget loads but cannot answer until an AI provider key is set.",
      remedy: !settings.ai.chatEnabled
        ? "Enable the chat under Admin → Settings → AI."
        : aiUsable
          ? undefined
          : "Set AI_API_KEY to enable answers.",
    },
  ];

  return capabilities;
}

/** A one-line summary used by `/api/health` and the bootstrap report. */
export function capabilitySummary(capabilities: Capability[]): {
  enabled: number;
  manual: number;
  degraded: number;
  disabled: number;
} {
  return {
    enabled: capabilities.filter((item) => item.state === "enabled").length,
    manual: capabilities.filter((item) => item.state === "manual").length,
    degraded: capabilities.filter((item) => item.state === "degraded").length,
    disabled: capabilities.filter((item) => item.state === "disabled").length,
  };
}
