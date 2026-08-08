import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import { siteSettings } from "@/lib/server/db/collections";
import type { SiteSettingsDoc } from "@/lib/server/db/types";
import { siteConfig } from "@/lib/site";

/**
 * Editable site settings.
 *
 * Two jobs. First, it lets the owner change contact details, automation
 * thresholds, and AI configuration from the admin panel instead of a code
 * deploy. Second, it retires the `TODO(client)` placeholders in
 * `src/lib/site.ts`: those values are emitted into Organization JSON-LD,
 * `llms.txt`, and every outbound email, so a placeholder that survives to
 * launch publishes a fake phone number to search engines.
 *
 * Reads are cached and invalidated by tag on write, so the settings lookup does
 * not add a database round trip to every page render.
 */

export const SETTINGS_ID = "site";
export const SETTINGS_CACHE_TAG = "site-settings";

/**
 * Defaults chosen conservatively. In particular `requireApproval` is true and
 * `blockConsentRequiredRegions` is true: cold outreach is lawful opt-out B2B
 * mail in India and the US but requires prior consent under GDPR and CASL, and
 * an unthrottled first send would burn the sending domain's reputation. Both
 * are one toggle away in the admin panel — but off by default is the only
 * defensible starting position.
 */
export const SETTINGS_DEFAULTS = {
  automation: {
    requireApproval: true,
    perDomainDailyCap: 3,
    globalDailyCap: 150,
    blockConsentRequiredRegions: true,
    autoEnrich: true,
    harvestEmails: true,
    autopilot: false,
    autopilotScoreThreshold: 55,
    autopilotDailyEnrollCap: 20,
  },
  ai: {
    model: "google/gemini-2.5-flash",
    chatModel: "google/gemini-2.5-flash",
    chatEnabled: true,
  },
  map: {
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileAttribution: "© OpenStreetMap contributors",
  },
} as const;

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

/**
 * Every notification the platform can send, in one list.
 *
 * The list lives here rather than in the page that renders it, so adding a
 * notification anywhere in the product forces a decision about who receives it
 * and whether it is on — instead of a new email quietly appearing in someone's
 * inbox with no switch attached to it.
 */
export const NOTIFICATION_CHANNELS = [
  "formSubmission",
  "chatConversation",
  "booking",
  "lowBalance",
  "failedJob",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface NotificationChannelPrefs {
  enabled: boolean;
  /**
   * Extra addresses for this notification. Empty means "use
   * `defaultRecipients`" — it does **not** mean "send to nobody", because an
   * empty per-channel list is the state every channel starts in.
   */
  recipients: string[];
}

export interface NotificationSettings {
  /** Used by any channel whose own recipient list is empty. */
  defaultRecipients: string[];
  channels: Record<NotificationChannel, NotificationChannelPrefs>;
  chat: {
    /**
     * Notify on every conversation, not only on the ones the knowledge base
     * could not answer. Off by default: an unanswered question is a lead, a
     * successfully answered one is just traffic.
     */
    everyConversation: boolean;
    /** Ceiling on alert emails per chatbot per hour. */
    maxAlertsPerBotPerHour: number;
  };
  lowBalance: {
    /** Credits at or below which the low-balance warning fires. */
    threshold: number;
  };
}

export const NOTIFICATION_DEFAULTS: NotificationSettings = {
  defaultRecipients: [],
  channels: {
    formSubmission: { enabled: true, recipients: [] },
    chatConversation: { enabled: true, recipients: [] },
    booking: { enabled: true, recipients: [] },
    lowBalance: { enabled: true, recipients: [] },
    failedJob: { enabled: true, recipients: [] },
  },
  chat: { everyConversation: false, maxAlertsPerBotPerHour: 6 },
  lowBalance: { threshold: 50 },
};

/** The stored (all-optional) shape of the block above. */
export interface StoredNotificationSettings {
  defaultRecipients?: string[];
  channels?: Partial<
    Record<NotificationChannel, Partial<NotificationChannelPrefs>>
  >;
  chat?: { everyConversation?: boolean; maxAlertsPerBotPerHour?: number };
  lowBalance?: { threshold?: number };
}

/**
 * `SiteSettingsDoc` plus the notification block.
 *
 * Kept as an intersection here rather than added to the shared document
 * interface: this module is the only reader and the only writer of the block,
 * and the settings collection is schemaless, so widening the type at the point
 * of use is enough.
 */
export type StoredSiteSettings = SiteSettingsDoc & {
  notifications?: StoredNotificationSettings;
};

function resolveNotifications(
  stored: StoredNotificationSettings | undefined,
): NotificationSettings {
  const channels = {} as Record<NotificationChannel, NotificationChannelPrefs>;
  for (const channel of NOTIFICATION_CHANNELS) {
    const saved = stored?.channels?.[channel];
    channels[channel] = {
      enabled:
        saved?.enabled ?? NOTIFICATION_DEFAULTS.channels[channel].enabled,
      recipients: cleanRecipients(saved?.recipients),
    };
  }

  return {
    defaultRecipients: cleanRecipients(stored?.defaultRecipients),
    channels,
    chat: { ...NOTIFICATION_DEFAULTS.chat, ...pickDefined(stored?.chat) },
    lowBalance: {
      ...NOTIFICATION_DEFAULTS.lowBalance,
      ...pickDefined(stored?.lowBalance),
    },
  };
}

/**
 * Normalises a recipient list: lowercased, trimmed, de-duplicated, bounded.
 *
 * Deliverability is *not* checked here — that is `isDeliverableEmail`'s job at
 * send time, and rejecting a typo silently at read time would make the settings
 * page show a list that differs from what was saved.
 */
export function cleanRecipients(
  input: string[] | undefined | null,
  max = 10,
): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const entry of input) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim().toLowerCase();
    if (normalized) seen.add(normalized);
    if (seen.size >= max) break;
  }
  return [...seen];
}

/**
 * The addresses a given notification should reach.
 *
 * `extra` is a product's own list — a form's `notifyEmails`, a booking config's
 * `notifyEmails`. Those are deliberately *added to* rather than replaced by the
 * central settings: the per-record list is the answer to "who owns this form",
 * and silently overriding it from a global page would redirect a customer's
 * leads to whoever last edited settings. The central page is a floor, the
 * per-record list is the specific.
 */
export function recipientsForChannel(
  settings: ResolvedSettings,
  channel: NotificationChannel,
  extra: string[] = [],
): string[] {
  const prefs = settings.notifications.channels[channel];
  if (!prefs.enabled) return [];

  // The default list applies *in addition to* a channel's own list, so one
  // global "copy me on everything" address does not have to be repeated in
  // five places — and so clearing a channel's list never means "nobody".
  return cleanRecipients([
    ...prefs.recipients,
    ...extra,
    ...settings.notifications.defaultRecipients,
  ]);
}

export interface ResolvedSettings {
  contact: {
    email: string;
    salesEmail: string;
    phone: string;
    phoneHref: string;
    address: {
      line1: string;
      city: string;
      region: string;
      country: string;
      full: string;
      /** Postal address for email footers. Empty until the owner sets it. */
      postal: string;
    };
  };
  automation: {
    requireApproval: boolean;
    perDomainDailyCap: number;
    globalDailyCap: number;
    blockConsentRequiredRegions: boolean;
    autoEnrich: boolean;
    harvestEmails: boolean;
    autopilot: boolean;
    autopilotScoreThreshold: number;
    autopilotDailyEnrollCap: number;
  };
  ai: { model: string; chatModel: string; chatEnabled: boolean };
  map: { tileUrl: string; tileAttribution: string };
  outreach: {
    senderName: string;
    fromAddress: string | null;
    replyTo: string | null;
  };
  notifications: NotificationSettings;
}

function resolve(stored: StoredSiteSettings | null): ResolvedSettings {
  const contact = stored?.contact;
  const address = contact?.address;

  return {
    contact: {
      email: contact?.email?.trim() || siteConfig.contact.email,
      salesEmail: contact?.salesEmail?.trim() || siteConfig.contact.salesEmail,
      phone: contact?.phone?.trim() || siteConfig.contact.phone,
      phoneHref: contact?.phoneHref?.trim() || siteConfig.contact.phoneHref,
      address: {
        line1: address?.line1?.trim() || siteConfig.contact.address.line1,
        city: address?.city?.trim() || siteConfig.contact.address.city,
        region: address?.region?.trim() || siteConfig.contact.address.region,
        country: address?.country?.trim() || siteConfig.contact.address.country,
        full: address?.full?.trim() || siteConfig.contact.address.full,
        postal:
          address?.postal?.trim() ||
          process.env.OUTREACH_POSTAL_ADDRESS?.trim() ||
          "",
      },
    },
    automation: {
      ...SETTINGS_DEFAULTS.automation,
      ...pickDefined(stored?.automation),
    },
    ai: { ...SETTINGS_DEFAULTS.ai, ...pickDefined(stored?.ai) },
    map: { ...SETTINGS_DEFAULTS.map, ...pickDefined(stored?.map) },
    outreach: {
      senderName: stored?.outreach?.senderName?.trim() || siteConfig.founder,
      fromAddress:
        stored?.outreach?.fromAddress?.trim() ||
        process.env.OUTREACH_FROM?.trim() ||
        null,
      replyTo:
        stored?.outreach?.replyTo?.trim() ||
        process.env.OUTREACH_REPLY_TO?.trim() ||
        null,
    },
    notifications: resolveNotifications(stored?.notifications),
  };
}

/**
 * Drops `undefined` values so a partially-filled stored object cannot blank out
 * a default via object spread.
 */
function pickDefined<T extends object>(source: T | undefined): Partial<T> {
  if (!source) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value !== null) result[key] = value;
  }
  return result as Partial<T>;
}

/**
 * Reads settings straight from the database, bypassing the cache.
 *
 * Use this wherever a stale value would be a correctness problem rather than a
 * cosmetic one. In particular the outbound email path: `revalidateTag` with
 * `profile: "max"` gives stale-while-revalidate semantics, so a cached read
 * immediately after the owner sets a postal address can still return the empty
 * one — and a commercial email without a postal address is a compliance
 * failure, not a stale label.
 */
export async function getSettingsFresh(): Promise<ResolvedSettings> {
  try {
    const collection = await siteSettings();
    const stored = (await collection.findOne({
      _id: SETTINGS_ID,
    })) as StoredSiteSettings | null;
    return resolve(stored);
  } catch {
    // A database outage must not take the public site down; fall back to the
    // compiled-in configuration.
    return resolve(null);
  }
}

/**
 * Cached settings read, for rendering. Invalidated by `SETTINGS_CACHE_TAG` on
 * every write so the admin panel reflects a change without waiting for a TTL.
 */
export const getSettings = unstable_cache(getSettingsFresh, ["site-settings"], {
  tags: [SETTINGS_CACHE_TAG],
});

/**
 * Merges a patch into the stored settings.
 *
 * Uses dot-notation `$set` paths rather than replacing whole sub-objects, so
 * two admins editing different sections cannot clobber each other's changes.
 */
export async function updateSettings(
  patch: Partial<StoredSiteSettings>,
): Promise<void> {
  const collection = await siteSettings();
  const now = new Date();
  const flattened = flatten(patch);

  await collection.updateOne(
    { _id: SETTINGS_ID },
    {
      $set: { ...flattened, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  // Next 16 requires the second argument; the single-argument form is
  // deprecated. "max" gives stale-while-revalidate, which is right for
  // rendering — compliance-critical reads use `getSettingsFresh` instead.
  revalidateTag(SETTINGS_CACHE_TAG, "max");
}

/**
 * Flattens nested objects to dot paths (`{a:{b:1}}` becomes `{"a.b":1}`).
 * Arrays and dates are treated as leaves.
 */
export function flatten(
  input: Record<string, unknown>,
  prefix = "",
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (key === "_id" || value === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      Object.assign(output, flatten(value as Record<string, unknown>, path));
    } else {
      output[path] = value;
    }
  }

  return output;
}

/**
 * True when the compiled-in placeholder contact details are still in use.
 * Surfaced as a warning in the admin dashboard, because these values are
 * published in structured data and outbound email.
 */
export function hasPlaceholderContactDetails(settings: ResolvedSettings) {
  const placeholders = [
    // Legacy placeholders — only possible via a stale database override now
    // that `siteConfig` carries the real addresses.
    settings.contact.email === "hello@bitecodes.com",
    settings.contact.salesEmail === "sales@bitecodes.com",
    // Outreach footers legally require a postal address (CAN-SPAM).
    settings.contact.address.postal === "",
  ];
  return placeholders.some(Boolean);
}
