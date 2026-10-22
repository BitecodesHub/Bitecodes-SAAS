import type { CurrencyCode } from "@/lib/pricing";
import { MAINTENANCE_KEY } from "@/lib/proposals/pricing";
import type { ProposalDoc } from "@/lib/server/db/types";

/**
 * The shape the proposal editor edits and the server action validates.
 *
 * Deliberately flat and free of `Date` objects so it can cross the
 * server/client boundary without a serializer. Prices are absent: the server
 * rebuilds them from `selections` every time.
 */

export interface ProposalMilestoneInput {
  name: string;
  description: string;
  dueOffsetDays: number;
}

export interface ProposalSelectionInput {
  serviceSlug: string;
  quantity: number;
}

export interface ProposalFormValues {
  leadRef: string | null;
  clientName: string;
  clientEmail: string;
  company: string;
  title: string;
  summary: string;
  scope: string[];
  deliverables: string[];
  milestones: ProposalMilestoneInput[];
  selections: ProposalSelectionInput[];
  includeMaintenance: boolean;
  maintenanceMonths: number;
  assumptions: string[];
  exclusions: string[];
  currency: CurrencyCode;
  /** `YYYY-MM-DD`, or empty for no expiry. */
  validUntil: string;
  /** Set when the AI draft wrote part of the narrative. */
  aiAssisted?: boolean;
}

export function dateInputValue(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function defaultValidUntil(days = 30, now = new Date()): string {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function emptyProposalForm(): ProposalFormValues {
  return {
    leadRef: null,
    clientName: "",
    clientEmail: "",
    company: "",
    title: "",
    summary: "",
    scope: [],
    deliverables: [],
    milestones: [],
    selections: [],
    includeMaintenance: false,
    maintenanceMonths: 3,
    assumptions: [],
    exclusions: [],
    currency: "INR",
    validUntil: defaultValidUntil(),
    aiAssisted: false,
  };
}

export function textToLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function linesToText(lines: readonly string[]): string {
  return lines.join("\n");
}

export function proposalFormFromDoc(doc: ProposalDoc): ProposalFormValues {
  return {
    leadRef: doc.leadRef,
    clientName: doc.clientName,
    clientEmail: doc.clientEmail,
    company: doc.company ?? "",
    title: doc.title,
    summary: doc.summary,
    scope: doc.scope,
    deliverables: doc.deliverables,
    milestones: doc.milestones,
    selections: doc.lineItems
      .filter((line) => line.key !== MAINTENANCE_KEY)
      .map((line) => ({ serviceSlug: line.key, quantity: line.quantity })),
    includeMaintenance: doc.lineItems.some(
      (line) => line.key === MAINTENANCE_KEY,
    ),
    maintenanceMonths:
      doc.lineItems.find((line) => line.key === MAINTENANCE_KEY)?.quantity ?? 3,
    assumptions: doc.assumptions,
    exclusions: doc.exclusions,
    currency: doc.currency,
    validUntil: dateInputValue(doc.validUntil),
    aiAssisted: doc.aiAssisted,
  };
}
