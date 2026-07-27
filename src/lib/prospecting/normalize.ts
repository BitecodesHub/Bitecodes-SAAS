import { describeOsmTags } from "@/lib/prospecting/categories";

/**
 * Turns a raw Overpass element into the fields a prospect record needs.
 *
 * OSM is crowd-sourced, so nothing here can be assumed: names carry stray
 * whitespace, phone numbers are formatted a dozen ways, `website` values are
 * sometimes `tel:` links or bare domains, and coordinates live in different
 * places depending on whether the feature is a node or a way. Every one of those
 * is handled explicitly rather than trusted, because a single bad row would
 * otherwise reach an outbound email.
 *
 * Pure and dependency-free so the whole surface is unit-testable.
 */

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

export interface NormalizedProspect {
  sourceId: string;
  dedupeKey: string;
  name: string;
  category: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  socialUrl: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
}

/** Bounds on stored strings, so one malformed tag cannot bloat a document. */
const MAX_NAME = 160;
const MAX_ADDRESS = 240;
const MAX_URL = 500;

/**
 * Hosts that are a social or link-in-bio presence rather than a website.
 *
 * Matched on the registrable-ish suffix so `www.facebook.com` and
 * `m.facebook.com` both count. `business.site` and `sites.google.com` are
 * Google's free one-pagers; `*.wixsite.com` and `*.weebly.com` are unclaimed
 * builder subdomains — all of them mean "no real website" commercially.
 */
const SOCIAL_HOST_SUFFIXES = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.com",
  "wa.me",
  "whatsapp.com",
  "linktr.ee",
  "linkin.bio",
  "beacons.ai",
  "business.site",
  "sites.google.com",
  "google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "yelp.com",
  "tripadvisor.com",
  "zomato.com",
  "swiggy.com",
  "justdial.com",
  "indiamart.com",
  "wixsite.com",
  "weebly.com",
  "blogspot.com",
  "wordpress.com",
  "jimdosite.com",
  "godaddysites.com",
  "square.site",
  "myshopify.com",
];

export type WebsiteKind = "site" | "social" | "invalid";

/**
 * Cleans and classifies a `website`-ish tag value.
 *
 * OSM values arrive as `example.com`, `//example.com`, `http://example.com/`,
 * `tel:+91...`, or free text. Anything that is not an absolute http(s) URL after
 * one repair attempt is discarded rather than guessed at.
 */
export function normalizeWebsiteValue(raw: string | undefined | null): {
  kind: WebsiteKind;
  url: string | null;
} {
  const value = (raw ?? "").trim();
  if (!value || value.length > MAX_URL) return { kind: "invalid", url: null };

  // A semicolon-separated list is legal OSM; take the first entry.
  const first = value.split(";")[0]!.trim();
  if (!first) return { kind: "invalid", url: null };

  const candidate = /^https?:\/\//i.test(first)
    ? first
    : /^\/\//.test(first)
      ? `https:${first}`
      : // Only add a scheme to something that plausibly *is* a host, never to
        // free text like "ask at reception" or a `tel:` link.
        /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/|$|\?)/i.test(
            first,
          )
        ? `https://${first}`
        : "";

  if (!candidate) return { kind: "invalid", url: null };

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { kind: "invalid", url: null };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "invalid", url: null };
  }
  // A hostname with no dot is either a local name or a typo.
  if (!url.hostname.includes(".")) return { kind: "invalid", url: null };

  url.hash = "";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const isSocial = SOCIAL_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );

  return { kind: isSocial ? "social" : "site", url: url.toString() };
}

/**
 * Normalises a phone number to `+<digits>` where possible.
 *
 * No country inference: guessing a dialling code from an OSM address is how a
 * caller ends up dialling the wrong country. A local-format number is kept as
 * typed, minus separators.
 */
export function normalizePhone(raw: string | undefined | null): string | null {
  const value = (raw ?? "").split(";")[0]?.trim() ?? "";
  if (!value) return null;

  const hasPlus = value.trimStart().startsWith("+");
  const digits = value.replace(/\D/g, "");
  // Shorter than 6 digits is an extension or junk; longer than 15 breaks E.164.
  if (digits.length < 6 || digits.length > 15) return null;

  return hasPlus ? `+${digits}` : digits;
}

/** A conservative address-shaped email check; deliberately not RFC-complete. */
const EMAIL_PATTERN =
  /^[^\s@,;:<>()[\]\\"]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export function normalizeEmail(raw: string | undefined | null): string | null {
  let value = (raw ?? "").split(/[;,]/)[0]?.trim() ?? "";
  if (!value) return null;
  value = value
    .replace(/^mailto:/i, "")
    .trim()
    .toLowerCase();
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) return null;
  return value;
}

/** Collapses whitespace and trims to a bound. */
export function cleanText(
  raw: string | undefined | null,
  maxLength: number,
): string | null {
  const value = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength).trim() : value;
}

/**
 * A cross-provider identity key.
 *
 * Two records are the same business when the folded name matches and the
 * coordinates agree to three decimals (about 110 m). Diacritics, punctuation,
 * and the usual legal suffixes are stripped so "Café Rossi Pvt. Ltd." and
 * "Cafe Rossi" collapse to one key.
 */
export function buildDedupeKey(name: string, lat: number, lng: number): string {
  return `${foldName(name)}|${lat.toFixed(3)}|${lng.toFixed(3)}`;
}

const LEGAL_SUFFIXES =
  /\b(pvt|private|ltd|limited|llp|llc|inc|incorporated|corp|corporation|co|company|gmbh|bv|sa|srl|plc|pty)\b/g;

export function foldName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reads the element's representative point, wherever the provider put it. */
export function readCoordinates(
  element: OverpassElement,
): { lat: number; lng: number } | null {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

/**
 * Composes a street address from the `addr:*` family.
 *
 * Falls back to `addr:full` when the components are absent, since many regions
 * are mapped that way.
 */
export function composeAddress(tags: Record<string, string>): string | null {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:place"],
    tags["addr:suburb"] ?? tags["addr:neighbourhood"],
  ]
    .map((part) => (part ?? "").trim())
    .filter(Boolean);

  if (parts.length === 0) return cleanText(tags["addr:full"], MAX_ADDRESS);
  return cleanText(parts.join(", "), MAX_ADDRESS);
}

/**
 * Normalises one element, or returns null when it cannot be a prospect.
 *
 * A row is rejected — never patched up — when it has no usable name or no
 * usable coordinates, because both are load-bearing: the name goes into an
 * email greeting and the coordinates place the pin on the map.
 */
export function normalizeOverpassElement(
  element: OverpassElement,
): NormalizedProspect | null {
  const tags = element.tags ?? {};
  const name = cleanText(tags.name, MAX_NAME);
  if (!name) return null;

  const coordinates = readCoordinates(element);
  if (!coordinates) return null;

  if (!element.type || !Number.isFinite(element.id)) return null;

  const { categoryId, categoryLabel, rawCategory } = describeOsmTags(tags);

  const websiteCandidates = [
    tags.website,
    tags["contact:website"],
    tags.url,
    tags["website:official"],
  ];
  let website: string | null = null;
  let socialUrl: string | null = null;
  for (const candidate of websiteCandidates) {
    const { kind, url } = normalizeWebsiteValue(candidate);
    if (kind === "site" && !website) website = url;
    if (kind === "social" && !socialUrl) socialUrl = url;
  }
  // A dedicated social tag counts too, but only when nothing better was found.
  if (!website && !socialUrl) {
    for (const key of ["contact:facebook", "facebook", "contact:instagram"]) {
      const { kind, url } = normalizeWebsiteValue(tags[key]);
      if (kind === "social" || kind === "site") {
        socialUrl = url;
        break;
      }
    }
  }

  return {
    sourceId: `${element.type}/${element.id}`,
    dedupeKey: buildDedupeKey(name, coordinates.lat, coordinates.lng),
    name,
    category: rawCategory,
    categoryId,
    categoryLabel,
    phone:
      normalizePhone(tags.phone) ??
      normalizePhone(tags["contact:phone"]) ??
      normalizePhone(tags["contact:mobile"]) ??
      normalizePhone(tags.mobile),
    email: normalizeEmail(tags.email) ?? normalizeEmail(tags["contact:email"]),
    website,
    socialUrl,
    address: composeAddress(tags),
    city: cleanText(
      tags["addr:city"] ??
        tags["addr:town"] ??
        tags["addr:village"] ??
        tags["addr:suburb"],
      120,
    ),
    region: cleanText(
      tags["addr:state"] ?? tags["addr:province"] ?? tags["addr:district"],
      120,
    ),
    postcode: cleanText(tags["addr:postcode"], 24),
    countryCode: normalizeCountryCode(tags["addr:country"]),
    lat: coordinates.lat,
    lng: coordinates.lng,
  };
}

export function normalizeCountryCode(
  raw: string | undefined | null,
): string | null {
  const value = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

/**
 * Normalises a whole response and drops duplicates within it.
 *
 * One Overpass union can return the same business twice — as a node for the
 * point of interest and as a way for the building it occupies. De-duplicating
 * here, by `dedupeKey`, means the caller never writes both. The record that
 * carries more contact detail wins, since that is the one worth keeping.
 */
export function normalizeOverpassElements(
  elements: readonly OverpassElement[],
): { prospects: NormalizedProspect[]; skipped: number } {
  const byKey = new Map<string, NormalizedProspect>();
  let skipped = 0;

  for (const element of elements) {
    const prospect = normalizeOverpassElement(element);
    if (!prospect) {
      skipped += 1;
      continue;
    }

    const existing = byKey.get(prospect.dedupeKey);
    if (!existing) {
      byKey.set(prospect.dedupeKey, prospect);
      continue;
    }

    skipped += 1;
    if (contactRichness(prospect) > contactRichness(existing)) {
      byKey.set(prospect.dedupeKey, prospect);
    }
  }

  return { prospects: [...byKey.values()], skipped };
}

/** How useful a record is for outreach; used to break dedupe ties. */
function contactRichness(prospect: NormalizedProspect): number {
  return (
    (prospect.email ? 4 : 0) +
    (prospect.website ? 3 : 0) +
    (prospect.phone ? 2 : 0) +
    (prospect.socialUrl ? 1 : 0) +
    (prospect.address ? 1 : 0)
  );
}
