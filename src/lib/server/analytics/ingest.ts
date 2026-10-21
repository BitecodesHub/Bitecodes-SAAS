import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";
import { cleanAttributionValue, cleanLandingPath } from "@/lib/attribution";
import { isWebVitalName } from "@/lib/analytics";
import type {
  AnalyticsEventRecord,
  AnalyticsUtmFields,
} from "@/lib/server/db/types";

/**
 * Validation and cleaning for the analytics collector.
 *
 * The collector is a public, unauthenticated endpoint, so everything here
 * assumes hostile input. Two rules are absolute:
 *
 *  1. The only visitor identifier stored is a daily-rotating HMAC. The raw IP
 *     and user agent exist in memory for the duration of the request and are
 *     never written or logged.
 *  2. The only URL detail stored is the path (no query, no fragment) and the
 *     coarse referrer host. Campaign values are accepted only from the five
 *     standard `utm_*` fields and are cleaned with the same rules the forms
 *     use.
 */

export const ANALYTICS_MAX_BATCH = 20;
export const ANALYTICS_MAX_BODY_BYTES = 16_384;

const MAX_NAME_LENGTH = 80;
const MAX_REFERRER_LENGTH = 100;

const utmSchema = z
  .object({
    source: z.string().max(200).nullish(),
    medium: z.string().max(200).nullish(),
    campaign: z.string().max(200).nullish(),
    term: z.string().max(200).nullish(),
    content: z.string().max(200).nullish(),
  })
  .strict();

export const analyticsEventSchema = z
  .object({
    type: z.enum(["pageview", "event", "vital"]),
    path: z.string().min(1).max(400),
    name: z.string().max(120).nullish(),
    value: z.number().finite().min(-1_000_000_000).max(1_000_000_000).nullish(),
    referrerHost: z.string().max(500).nullish(),
    utm: utmSchema.nullish(),
    /** Client clock, epoch milliseconds. Bounded to a plausible window below. */
    ts: z.number().int().positive().nullish(),
  })
  .strict()
  .superRefine((event, context) => {
    if (event.type === "event" && !event.name) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "A custom event needs a name.",
      });
    }

    if (event.type === "vital") {
      const name = event.name?.trim().toUpperCase() ?? "";
      if (!isWebVitalName(name)) {
        context.addIssue({
          code: "custom",
          path: ["name"],
          message: "Unknown Web Vital.",
        });
      }
      if (typeof event.value !== "number" || event.value < 0) {
        context.addIssue({
          code: "custom",
          path: ["value"],
          message: "A Web Vital needs a non-negative value.",
        });
      }
    }
  });

export const analyticsBatchSchema = z
  .object({
    events: z.array(analyticsEventSchema).min(1).max(ANALYTICS_MAX_BATCH),
  })
  .strict();

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
export type AnalyticsBatchInput = z.infer<typeof analyticsBatchSchema>;

/**
 * User-agent heuristics for crawlers, previews, monitors, and automation.
 *
 * This is intentionally broad. A missed bot inflates a page-view count, while
 * a false positive only loses one measurement, so the list errs towards
 * exclusion. A missing user agent is treated as automated too: every real
 * browser sends one.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|monitor|uptime|pingdom|gtmetrix|lighthouse|pagespeed|headless|phantom|selenium|playwright|puppeteer|curl|wget|python-requests|python-urllib|aiohttp|axios|node-fetch|undici|go-http-client|java\/|okhttp|libwww|httpclient|scrapy|semrush|ahrefs|mj12|dotbot|petalbot|yandex|baidu|duckduck|facebookexternalhit|embedly|quora link|pinterest|vkshare|w3c_validator|whatsapp|telegram|linkedinbot|twitterbot|googlebot|bingbot|applebot|adidxbot|slackbot|discordbot/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const value = userAgent?.trim() ?? "";
  if (!value) return true;
  return BOT_PATTERN.test(value);
}

/** True when the request headers carry Do Not Track or Global Privacy Control. */
export function doNotTrackEnabled(headers: {
  get(name: string): string | null;
}): boolean {
  const dnt = headers.get("dnt")?.trim();
  const gpc = headers.get("sec-gpc")?.trim();
  return dnt === "1" || gpc === "1";
}

/**
 * A path only: no query string, no fragment, bounded, and never something that
 * looks like an address.
 */
export function cleanAnalyticsPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return cleanLandingPath(trimmed);
}

/**
 * Extracts and validates the host part of a referrer. Both a bare host
 * ("www.google.com") and a full URL are accepted; only the hostname survives.
 */
export function cleanReferrerHost(
  value: string | null | undefined,
  ownHost?: string | null,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let hostname: string;
  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }

  if (!/^[a-z0-9.-]{1,100}$/.test(hostname)) return null;
  if (ownHost) {
    const strip = (host: string) => host.toLowerCase().replace(/^www\./, "");
    if (strip(hostname) === strip(ownHost)) return null;
  }
  return hostname.slice(0, MAX_REFERRER_LENGTH);
}

/** Event names are machine identifiers: lowercase, bounded, predictable. */
export function cleanAnalyticsName(
  value: string | null | undefined,
): string | null {
  const name = value?.trim().toLowerCase() ?? "";
  if (!name || name.length > MAX_NAME_LENGTH) return null;
  if (!/^[a-z0-9][a-z0-9_.:-]*$/.test(name)) return null;
  return name;
}

function cleanUtm(
  input: AnalyticsEventInput["utm"],
): AnalyticsUtmFields | null {
  if (!input) return null;
  const cleaned: AnalyticsUtmFields = {
    source: cleanAttributionValue(input.source),
    medium: cleanAttributionValue(input.medium),
    campaign: cleanAttributionValue(input.campaign),
    term: cleanAttributionValue(input.term),
    content: cleanAttributionValue(input.content),
  };
  return Object.values(cleaned).some(Boolean) ? cleaned : null;
}

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_EVENT_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * Uses the client timestamp only when it is plausible. A clock set years ahead
 * would otherwise file today's traffic under a date that never rolls up.
 */
export function resolveAnalyticsTime(
  ts: number | null | undefined,
  now = Date.now(),
): Date {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return new Date(now);
  if (ts > now + MAX_CLOCK_SKEW_MS) return new Date(now);
  if (ts < now - MAX_EVENT_AGE_MS) return new Date(now);
  return new Date(ts);
}

/**
 * A one-way, daily-rotating visitor identifier.
 *
 * The salt is an HMAC of the UTC date keyed by AUTH_SECRET, so hashes from two
 * days cannot be joined together, and the secret never leaves the server. The
 * same person on the same day produces the same hash; nobody can reverse it.
 */
export function analyticsVisitorHash(input: {
  ip: string;
  userAgent: string;
  date: string;
  secret: string;
}): string {
  const daySalt = createHmac("sha256", input.secret)
    .update(`analytics-visitor:${input.date}`)
    .digest("hex");
  return createHmac("sha256", daySalt)
    .update(`${input.ip}\n${input.userAgent}`)
    .digest("hex");
}

/**
 * Turns a validated batch into documents ready for insertion.
 *
 * Events that cannot be cleaned (a non-local path, an unknown vital, a name
 * full of punctuation) are dropped individually rather than rejecting the
 * batch, so one malformed event from an older cached bundle does not discard
 * the rest of a visitor's session.
 */
export function toAnalyticsEventRecords(
  batch: AnalyticsBatchInput,
  options: {
    visitorHash: string;
    now?: number;
    ownHost?: string | null;
  },
): AnalyticsEventRecord[] {
  const records: AnalyticsEventRecord[] = [];
  const now = options.now ?? Date.now();

  for (const event of batch.events) {
    const path = cleanAnalyticsPath(event.path);
    if (!path) continue;

    let name: string | null = null;
    let value: number | null = null;

    if (event.type === "event") {
      name = cleanAnalyticsName(event.name);
      if (!name) continue;
      value =
        typeof event.value === "number" && Number.isFinite(event.value)
          ? event.value
          : null;
    } else if (event.type === "vital") {
      name = event.name?.trim().toUpperCase() ?? null;
      if (!name || !isWebVitalName(name)) continue;
      value = event.value ?? null;
      if (value === null || value < 0) continue;
    }

    records.push({
      type: event.type,
      path,
      name,
      value,
      referrerHost:
        event.type === "pageview"
          ? cleanReferrerHost(event.referrerHost, options.ownHost)
          : null,
      utm: cleanUtm(event.utm),
      visitorHash: options.visitorHash,
      createdAt: resolveAnalyticsTime(event.ts, now),
    });
  }

  return records;
}
