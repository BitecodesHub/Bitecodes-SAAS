/**
 * Compliance gates for cold outreach.
 *
 * Cold B2B email is lawful in India and the United States under an **opt-out**
 * model (CAN-SPAM): a clear sender identity, a physical postal address, and a
 * working unsubscribe. It is lawful in Australia and most of Asia on similar
 * terms. It is **not** lawful without prior consent in the EU/EEA and UK
 * (GDPR/ePrivacy) or Canada (CASL), where penalties are per-message.
 *
 * This module encodes that difference so the send path can enforce it rather
 * than relying on whoever writes the campaign to remember. Every function is
 * pure and unit-tested; the enforcement point is `email/send.ts`.
 *
 * Not legal advice — the thresholds are conservative defaults, and the owner
 * can override them knowingly in the admin panel.
 */

/**
 * ISO 3166-1 alpha-2 codes where unsolicited commercial email requires prior
 * consent. EU 27 + EEA + UK + Switzerland + Canada.
 */
export const CONSENT_REQUIRED_COUNTRIES = new Set([
  // EU 27
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  // EEA
  "IS",
  "LI",
  "NO",
  // United Kingdom, Switzerland
  "GB",
  "CH",
  // Canada (CASL)
  "CA",
]);

export function isConsentRequiredCountry(
  countryCode: string | null | undefined,
): boolean {
  if (!countryCode) return false;
  return CONSENT_REQUIRED_COUNTRIES.has(countryCode.trim().toUpperCase());
}

/**
 * Country-code top-level domains that imply a consent-required jurisdiction.
 *
 * A second signal for when the provider gave no country: a business emailing
 * from `@example.de` is almost certainly in Germany. Only unambiguous ccTLDs
 * are listed — `.co` (Colombia) and `.io` are widely used as generic domains,
 * so they are excluded rather than producing false positives.
 */
const CONSENT_REQUIRED_TLDS = new Set([
  "at",
  "be",
  "bg",
  "hr",
  "cy",
  "cz",
  "dk",
  "ee",
  "fi",
  "fr",
  "de",
  "gr",
  "hu",
  "ie",
  "it",
  "lv",
  "lt",
  "lu",
  "mt",
  "nl",
  "pl",
  "pt",
  "ro",
  "sk",
  "si",
  "es",
  "se",
  "is",
  "li",
  "no",
  "uk",
  "ch",
  "ca",
]);

export function domainImpliesConsentRequired(
  domain: string | null | undefined,
): boolean {
  if (!domain) return false;
  const parts = domain.trim().toLowerCase().split(".");
  const tld = parts.at(-1);
  return Boolean(tld && CONSENT_REQUIRED_TLDS.has(tld));
}

export type SendBlockReason =
  | "suppressed"
  | "undeliverable"
  | "never-contact"
  | "consent-required-region"
  | "domain-cap"
  | "global-cap"
  | "missing-postal-address"
  | "missing-unsubscribe"
  | "incomplete-template";

export interface OutreachGateInput {
  /** Already normalised. */
  email: string;
  /** From the discovery provider, when known. */
  countryCode: string | null;
  suppressed: boolean;
  deliverable: boolean;
  neverContact: boolean;
  /** Messages already sent to this recipient domain in the current day. */
  domainSentToday: number;
  /** Messages already sent across all recipients in the current day. */
  globalSentToday: number;
  perDomainDailyCap: number;
  globalDailyCap: number;
  blockConsentRequiredRegions: boolean;
  hasPostalAddress: boolean;
  hasUnsubscribeUrl: boolean;
  /** Variables the rendered template could not fill. */
  missingVariables: string[];
}

export interface OutreachGateResult {
  allowed: boolean;
  reason: SendBlockReason | null;
  /** Human-readable explanation, shown in the admin outbox. */
  detail: string | null;
}

/**
 * The single decision point for whether a cold outreach message may be sent.
 *
 * Checks run cheapest-and-most-absolute first, so the recorded reason is the
 * most fundamental one rather than whichever check happened to run first.
 */
export function evaluateOutreachGate(
  input: OutreachGateInput,
): OutreachGateResult {
  if (!input.deliverable) {
    return {
      allowed: false,
      reason: "undeliverable",
      detail: "The address does not look deliverable.",
    };
  }

  if (input.neverContact) {
    return {
      allowed: false,
      reason: "never-contact",
      detail:
        "The address is an automated or abuse mailbox and must not receive outreach.",
    };
  }

  if (input.suppressed) {
    return {
      allowed: false,
      reason: "suppressed",
      detail: "The recipient or their domain is on the suppression list.",
    };
  }

  // Legal gates before volume gates: a message that must not be sent at all
  // should not be reported as merely rate-limited.
  if (input.blockConsentRequiredRegions) {
    const byCountry = isConsentRequiredCountry(input.countryCode);
    const byDomain =
      !input.countryCode &&
      domainImpliesConsentRequired(input.email.split("@").at(-1) ?? null);

    if (byCountry || byDomain) {
      return {
        allowed: false,
        reason: "consent-required-region",
        detail:
          "Unsolicited commercial email requires prior consent in this jurisdiction (GDPR/CASL).",
      };
    }
  }

  if (!input.hasPostalAddress) {
    return {
      allowed: false,
      reason: "missing-postal-address",
      detail:
        "Commercial email must carry a physical postal address. Set one in Settings.",
    };
  }

  if (!input.hasUnsubscribeUrl) {
    return {
      allowed: false,
      reason: "missing-unsubscribe",
      detail: "Commercial email must carry a working unsubscribe link.",
    };
  }

  if (input.missingVariables.length > 0) {
    return {
      allowed: false,
      reason: "incomplete-template",
      detail: `The template is missing values for: ${input.missingVariables.join(", ")}.`,
    };
  }

  if (input.globalSentToday >= input.globalDailyCap) {
    return {
      allowed: false,
      reason: "global-cap",
      detail: `The daily send cap of ${input.globalDailyCap} has been reached.`,
    };
  }

  if (input.domainSentToday >= input.perDomainDailyCap) {
    return {
      allowed: false,
      reason: "domain-cap",
      detail: `The per-domain daily cap of ${input.perDomainDailyCap} has been reached for this recipient's domain.`,
    };
  }

  return { allowed: true, reason: null, detail: null };
}

/**
 * Spacing between sends, with jitter.
 *
 * A burst of identical messages arriving at one provider in the same second is
 * the clearest possible spam signal. `random` is injectable for tests.
 */
export function nextSendDelayMs(
  index: number,
  baseSpacingMs = 90_000,
  random = Math.random,
): number {
  const jitter = Math.round((random() - 0.5) * baseSpacingMs * 0.5);
  return Math.max(0, index * baseSpacingMs + jitter);
}
