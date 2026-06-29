/**
 * Per-service "starting from" pricing for Bitecodes.
 *
 * Source of truth: every service has a single canonical USD starting price
 * (`startingFromUSD`) plus a billing `model` and `unit`. INR and AUD are
 * DERIVED at build time from static FX rates so SSR HTML and JSON-LD stay
 * deterministic and match each other (required for Google price rich results).
 *
 * Rates are re-pinned quarterly — see `FX_RATES`. Do NOT fetch FX at request
 * time; that breaks the JSON-LD/HTML match guarantee.
 */

export type BillingUnit = "project" | "month" | "hour" | "day";

export type CurrencyCode = "USD" | "INR" | "AUD";

/** Static, build-time FX rates (USD -> target). Re-pin quarterly. */
export const FX_RATES: Record<Exclude<CurrencyCode, "USD">, number> = {
  INR: 83, // 1 USD ≈ 83 INR (2026)
  AUD: 1.5, // 1 USD ≈ 1.50 AUD (2026)
};

export interface CurrencyMeta {
  code: CurrencyCode;
  label: string;
  locale: string;
  /** Intl currency symbol resolves from locale+code; kept for reference. */
  symbol: string;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: "USD", label: "US Dollar", locale: "en-US", symbol: "$" },
  { code: "INR", label: "Indian Rupee", locale: "en-IN", symbol: "₹" },
  { code: "AUD", label: "Australian Dollar", locale: "en-AU", symbol: "A$" },
];

export interface ServicePricing {
  slug: string;
  /** Human billing model label, e.g. "Fixed project". */
  model: string;
  /** Granular unit for the price, drives the "per X" suffix. */
  unit: BillingUnit;
  /** Canonical starting price in USD. INR/AUD are derived from this. */
  startingFromUSD: number;
}

/**
 * All 19 services (matches src/data/services.ts). Prices are realistic
 * starting-from figures for an India-based outsourced software studio
 * competing globally. "from" = floor for a scoped engagement.
 */
export const SERVICE_PRICING: ServicePricing[] = [
  {
    slug: "website-development",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 2500,
  },
  {
    slug: "web-applications",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 8000,
  },
  {
    slug: "enterprise-software",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 25000,
  },
  {
    slug: "saas-development",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 12000,
  },
  {
    slug: "custom-software",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 10000,
  },
  {
    slug: "rest-api-development",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 4000,
  },
  {
    slug: "frontend-development",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 4000,
  },
  {
    slug: "backend-development",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 6000,
  },
  {
    slug: "mobile-app-development",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 9000,
  },
  {
    slug: "cloud-solutions",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 3500,
  },
  {
    slug: "devops",
    model: "Monthly retainer",
    unit: "month",
    startingFromUSD: 2500,
  },
  {
    slug: "ai-integration",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 6000,
  },
  {
    slug: "mcp-servers",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 4000,
  },
  {
    slug: "business-automation",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 3000,
  },
  {
    slug: "deployment",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 1500,
  },
  {
    slug: "maintenance-support",
    model: "Monthly retainer",
    unit: "month",
    startingFromUSD: 1500,
  },
  {
    slug: "performance-optimization",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 2500,
  },
  {
    slug: "ui-ux-development",
    model: "Fixed project",
    unit: "project",
    startingFromUSD: 3500,
  },
  {
    slug: "technical-consulting",
    model: "Hourly",
    unit: "hour",
    startingFromUSD: 90,
  },
];

/** Lookup helper. */
export function getPricing(slug: string): ServicePricing | undefined {
  return SERVICE_PRICING.find((p) => p.slug === slug);
}

/**
 * Convert a USD amount to a target currency with sensible rounding.
 * USD is returned as-is (clean integer). INR rounds to nearest 100 (or 500
 * for large amounts), AUD rounds to nearest 10.
 */
export function convertPrice(usd: number, currency: CurrencyCode): number {
  if (currency === "USD") return usd;
  const rate = FX_RATES[currency];
  const raw = usd * rate;
  if (currency === "INR") {
    const step = raw >= 100000 ? 500 : 100;
    return Math.round(raw / step) * step;
  }
  // AUD
  return Math.round(raw / 10) * 10;
}

/**
 * Locale-aware currency formatting. en-IN yields lakh grouping
 * (e.g. ₹4,15,000), en-AU and en-US use thousands grouping.
 */
export function formatPrice(usd: number, currency: CurrencyCode): string {
  const amount = convertPrice(usd, currency);
  const meta = CURRENCIES.find((c) => c.code === currency)!;
  const formatted = new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
  // en-AU + AUD can collapse to a bare "$" on some Node ICU builds, making
  // AUD indistinguishable from USD (especially in the LLM-facing llms.txt /
  // llms-full.txt). Force the unambiguous symbol declared in CURRENCIES.
  if (currency === "AUD" && formatted.startsWith("$")) {
    return `${meta.symbol}${formatted.slice(1)}`;
  }
  return formatted;
}

/** Unit display label for the "per X" suffix. */
export function unitLabel(unit: BillingUnit): string {
  switch (unit) {
    case "project":
      return "project";
    case "month":
      return "month";
    case "hour":
      return "hour";
    case "day":
      return "day";
  }
}

/** Human "per X" phrase, e.g. "per project", "per month". */
export function unitPhrase(unit: BillingUnit): string {
  return `per ${unitLabel(unit)}`;
}

/** A single price row for rendering + schema. */
export interface PriceRow {
  currency: CurrencyCode;
  formatted: string; // e.g. "$2,500"
  unit: BillingUnit;
}

/** All three currency rows for a service (for the visible <dl> + JSON-LD). */
export function priceRows(slug: string): PriceRow[] | null {
  const p = getPricing(slug);
  if (!p) return null;
  return CURRENCIES.map((c) => ({
    currency: c.code,
    formatted: formatPrice(p.startingFromUSD, c.code),
    unit: p.unit,
  }));
}

/**
 * One-line multi-currency starting price for LLM-facing text, e.g.
 * "from $2,500 / ₹2,07,500 / A$3,750 per project".
 */
export function formatStartingPrice(p: ServicePricing): string {
  const parts = CURRENCIES.map((c) => formatPrice(p.startingFromUSD, c.code));
  return `from ${parts.join(" / ")} ${unitPhrase(p.unit)}`;
}
