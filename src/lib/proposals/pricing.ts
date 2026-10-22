import { services } from "@/data/services";
import {
  convertPrice,
  getPricing,
  unitPhrase,
  type CurrencyCode,
} from "@/lib/pricing";

/**
 * Deterministic proposal pricing.
 *
 * A proposal line is built only from a service slug that exists in
 * `src/lib/pricing.ts` and a quantity. No model output, browser value, or
 * operator free-text can set a price: the server recomputes every line from
 * the published source before saving or sending. That is the rule the audit
 * asked for and the only way the public proposal can never contradict /pricing.
 *
 * Kept free of server imports so the admin editor can preview the same totals
 * the server will calculate.
 */

export const PROPOSAL_MAX_LINES = 10;
export const PROPOSAL_MAX_QUANTITY = 100;
export const PROPOSAL_MAX_MILESTONES = 6;
export const MAINTENANCE_SERVICE_SLUG = "maintenance-support";
export const MAINTENANCE_KEY = "maintenance-retainer";

export interface ProposalSelection {
  serviceSlug: string;
  quantity: number;
}

export interface BuiltProposalLine {
  key: string;
  label: string;
  description: string | null;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface BuiltProposalPaymentTerm {
  label: string;
  percent: number;
  amount: number;
}

export interface BuiltProposalRetainerUpsell {
  serviceSlug: string;
  label: string;
  description: string;
  months: number;
  monthlyAmount: number;
  totalAmount: number;
}

export interface BuiltProposalPricing {
  currency: CurrencyCode;
  lineItems: BuiltProposalLine[];
  total: number;
  retainerUpsell: BuiltProposalRetainerUpsell | null;
  paymentSchedule: BuiltProposalPaymentTerm[];
}

export interface ProposalPricingInput {
  currency: CurrencyCode;
  selections: readonly ProposalSelection[];
  includeMaintenance: boolean;
  maintenanceMonths: number;
  milestoneCount: number;
}

const serviceTitleBySlug = new Map(
  services.map((service) => [service.slug, service.title]),
);

/** Published title for a slug, with a readable fallback for unknown data. */
export function proposalServiceTitle(slug: string): string {
  return (
    serviceTitleBySlug.get(slug) ??
    slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(PROPOSAL_MAX_QUANTITY, Math.max(1, Math.round(value)));
}

function clampMonths(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(12, Math.max(1, Math.round(value)));
}

/**
 * Splits a total into a deposit, milestone terms, and a final payment.
 *
 * The percentages are a commercial default, not a price: the operator can
 * change the milestone count and the schedule follows. The last term absorbs
 * rounding so the schedule always sums to the total exactly.
 */
export function buildPaymentSchedule(
  total: number,
  milestoneCount: number,
): BuiltProposalPaymentTerm[] {
  const count = Math.min(
    PROPOSAL_MAX_MILESTONES,
    Math.max(1, Math.round(milestoneCount)),
  );

  let percents: number[];
  if (count === 1) {
    percents = [100];
  } else if (count === 2) {
    percents = [50, 50];
  } else {
    const middleCount = count - 2;
    const middlePercent = Math.floor(30 / middleCount);
    const middle = Array.from({ length: middleCount }, () => middlePercent);
    const final = 100 - 40 - middlePercent * middleCount;
    percents = [40, ...middle, final];
  }

  const labels =
    count === 1
      ? ["Final payment on acceptance"]
      : count === 2
        ? ["Deposit on signing", "Final payment on delivery"]
        : [
            "Deposit on signing",
            ...Array.from(
              { length: count - 2 },
              (_, index) => `Milestone ${index + 2}`,
            ),
            "Final payment on delivery",
          ];

  let allocated = 0;
  return percents.map((percent, index) => {
    const isLast = index === percents.length - 1;
    const amount = isLast
      ? total - allocated
      : Math.round((total * percent) / 100);
    allocated += amount;
    return { label: labels[index]!, percent, amount };
  });
}

function buildRetainerUpsell(
  currency: CurrencyCode,
  months: number,
): BuiltProposalRetainerUpsell | null {
  const pricing = getPricing(MAINTENANCE_SERVICE_SLUG);
  if (!pricing) return null;
  const monthlyAmount = convertPrice(pricing.startingFromUSD, currency);
  return {
    serviceSlug: MAINTENANCE_SERVICE_SLUG,
    label: proposalServiceTitle(MAINTENANCE_SERVICE_SLUG),
    description:
      "Ongoing maintenance and support under the published response targets, billed monthly in advance.",
    months,
    monthlyAmount,
    totalAmount: monthlyAmount * months,
  };
}

/**
 * Builds every priced line, the total, the optional retainer suggestion, and
 * the payment schedule from the operator's selections.
 */
export function buildProposalPricing(
  input: ProposalPricingInput,
): BuiltProposalPricing {
  const bySlug = new Map<string, number>();
  for (const selection of input.selections) {
    const pricing = getPricing(selection.serviceSlug);
    if (!pricing || selection.serviceSlug === MAINTENANCE_SERVICE_SLUG) {
      continue;
    }
    const quantity = clampQuantity(selection.quantity);
    bySlug.set(
      selection.serviceSlug,
      Math.min(
        PROPOSAL_MAX_QUANTITY,
        (bySlug.get(selection.serviceSlug) ?? 0) + quantity,
      ),
    );
  }

  const lineItems: BuiltProposalLine[] = [];
  for (const [serviceSlug, quantity] of [...bySlug.entries()].slice(
    0,
    PROPOSAL_MAX_LINES,
  )) {
    const pricing = getPricing(serviceSlug);
    if (!pricing) continue;
    const unitAmount = convertPrice(pricing.startingFromUSD, input.currency);
    lineItems.push({
      key: serviceSlug,
      label: proposalServiceTitle(serviceSlug),
      description: `${pricing.model}. Quoted ${unitPhrase(pricing.unit)}.`,
      quantity,
      unitAmount,
      amount: unitAmount * quantity,
    });
  }

  const maintenanceMonths = clampMonths(input.maintenanceMonths);
  if (input.includeMaintenance) {
    const retainer = buildRetainerUpsell(input.currency, maintenanceMonths);
    if (retainer) {
      lineItems.push({
        key: MAINTENANCE_KEY,
        label: `${retainer.label} retainer`,
        description: `${retainer.description} ${retainer.months} month(s).`,
        quantity: retainer.months,
        unitAmount: retainer.monthlyAmount,
        amount: retainer.totalAmount,
      });
    }
  }

  const total = lineItems.reduce((sum, line) => sum + line.amount, 0);

  return {
    currency: input.currency,
    lineItems,
    total,
    retainerUpsell: input.includeMaintenance
      ? null
      : lineItems.length > 0
        ? buildRetainerUpsell(input.currency, maintenanceMonths)
        : null,
    paymentSchedule: buildPaymentSchedule(total, input.milestoneCount),
  };
}
