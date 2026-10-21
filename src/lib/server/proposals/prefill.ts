import "server-only";

import { services } from "@/data/services";
import {
  consultantInputSchema,
  consultantRecommendationSchema,
} from "@/lib/ai-consultant";
import type { ProposalLeadKind, ProposalLeadRef } from "@/lib/server/db/types";
import type { LeadDetail } from "@/lib/server/leads/repository";
import {
  defaultValidUntil,
  emptyProposalForm,
  type ProposalFormValues,
  type ProposalSelectionInput,
} from "@/lib/proposals/form";

/**
 * Builds the first draft of a proposal from an inbound lead.
 *
 * This is a deterministic prefill, not an AI call: the consultant already
 * produced a structured recommendation, the audit already produced findings,
 * and the enquiry already contains the client's own words. The operator edits
 * the result, and the "AI draft scope" action can fill the prose afterwards.
 *
 * Every value that came from a lead is untrusted. It is stored as plain text
 * and rendered as text, never interpreted as markup.
 */

const slugByServiceTitle = new Map(
  services.map((service) => [service.title, service.slug]),
);

/** Fallback selection when a consultant did not name a service. */
const slugByProjectType: Record<string, string> = {
  website: "website-development",
  ecommerce: "website-development",
  "web-app": "web-applications",
  saas: "saas-development",
  "mobile-app": "mobile-app-development",
  enterprise: "enterprise-software",
  "ai-automation": "ai-integration",
  "not-sure": "website-development",
};

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

function stringField(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string {
  const value = record?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function companyLabel(clientName: string, company: string): string {
  return company || clientName;
}

export interface ProposalPrefill extends ProposalFormValues {
  leadKind: ProposalLeadKind;
  leadId: string;
  /** Human note about where the prefill came from, shown above the editor. */
  sourceNote: string;
}

export function proposalLeadRef(
  kind: ProposalLeadKind,
  id: string,
): ProposalLeadRef {
  return `${kind}:${id}`;
}

function baseForm(): ProposalFormValues {
  return {
    ...emptyProposalForm(),
    validUntil: defaultValidUntil(),
    assumptions: [
      "The client provides content, brand assets, and access to third-party systems in a timely manner.",
      "The scope covers the services listed in this proposal. Anything not listed is a change request, quoted in writing before work begins.",
    ],
    exclusions: [
      "Third-party subscriptions, cloud usage, payment processor fees, and app-store fees.",
      "GST and any other applicable taxes.",
      "Work outside the scope, deliverables, and assumptions stated in this proposal.",
    ],
  };
}

/** Splits long free text into proposal lines that pass the form limits. */
function chunkLines(value: string, max: number, limit: number): string[] {
  const lines: string[] = [];
  let rest = value.trim();
  while (rest.length > 0 && lines.length < limit) {
    if (rest.length <= max) {
      lines.push(rest);
      break;
    }
    const cut = rest.lastIndexOf(" ", max);
    const at = cut > max / 2 ? cut : max;
    lines.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  return lines;
}

function deliverablesForTitles(titles: readonly string[]): string[] {
  if (titles.length === 0) return [];
  return [
    ...titles.map(
      (title) =>
        `${title}: delivered to the acceptance criteria agreed before the build starts.`,
    ),
    "Repository access, deployment documentation, and a written handover.",
  ];
}

/**
 * Turns a loaded lead into a prefilled form. The caller has already authorised
 * `manage_leads` and resolved the kind/id from the URL.
 */
export function prefillFromLead(
  kind: ProposalLeadKind,
  id: string,
  lead: LeadDetail,
): ProposalPrefill {
  const form = baseForm();
  form.leadRef = proposalLeadRef(kind, id);

  if (lead.kind === "enquiry") {
    const doc = lead.doc;
    form.clientName = clip(doc.name, 160);
    form.clientEmail = doc.email;
    form.company = clip(doc.company ?? "", 160);
    form.title = clip(
      `Proposal for ${companyLabel(doc.name, doc.company ?? "")}`,
      180,
    );
    form.summary = doc.message.slice(0, 2_000);
    form.scope = doc.message ? chunkLines(doc.message, 400, 6) : [];
    form.selections = [{ serviceSlug: "website-development", quantity: 1 }];
    return {
      ...form,
      leadKind: kind,
      leadId: id,
      sourceNote:
        "Prefilled from the contact enquiry. Review the scope before sending.",
    };
  }

  if (lead.kind === "consultant") {
    const doc = lead.doc;
    const input = doc.input ?? {};
    const recommendation = consultantRecommendationSchema.safeParse(
      doc.recommendation,
    );
    const brief = consultantInputSchema.safeParse(input);
    const name = stringField(input, "name");
    const company = stringField(input, "company");
    const email = doc.email ?? stringField(input, "email");

    form.clientName = clip(name, 160);
    form.clientEmail = email;
    form.company = clip(company, 160);
    form.summary = brief.success ? brief.data.goals.slice(0, 2_000) : "";

    if (recommendation.success) {
      const rec = recommendation.data;
      form.title = clip(
        `${rec.recommendedPackage} proposal for ${companyLabel(name, company)}`,
        180,
      );
      form.summary = rec.summary;
      form.scope = rec.scope;
      form.assumptions = [...rec.assumptions, ...form.assumptions];
      const selections: ProposalSelectionInput[] = [];
      for (const title of rec.recommendedServices) {
        const slug = slugByServiceTitle.get(title);
        if (slug && !selections.some((item) => item.serviceSlug === slug)) {
          selections.push({ serviceSlug: slug, quantity: 1 });
        }
      }
      form.selections =
        selections.length > 0
          ? selections
          : [{ serviceSlug: "website-development", quantity: 1 }];
      form.deliverables = deliverablesForTitles(rec.recommendedServices);
    } else {
      form.title = clip(`Proposal for ${companyLabel(name, company)}`, 180);
      const projectType = stringField(input, "projectType");
      form.selections = [
        {
          serviceSlug: slugByProjectType[projectType] ?? "website-development",
          quantity: 1,
        },
      ];
    }

    return {
      ...form,
      leadKind: kind,
      leadId: id,
      sourceNote: recommendation.success
        ? "Prefilled from the AI consultant's structured recommendation. Prices are recalculated from the published service floors."
        : "Prefilled from the AI consultant brief. The recommendation was unavailable, so the scope needs a review.",
    };
  }

  if (lead.kind !== "audit") {
    return {
      ...form,
      leadKind: kind,
      leadId: id,
      sourceNote:
        "This lead kind is not supported by the proposal prefill. Start from the brief and add the client details by hand.",
    };
  }

  const doc = lead.doc;
  const hostname = doc.hostname;
  form.clientName = "";
  form.clientEmail = doc.email ?? "";
  form.company = clip(hostname, 160);
  form.title = clip(`Website improvement proposal for ${hostname}`, 180);
  form.summary = `A proposal to address the findings from the website audit of ${doc.auditedUrl}${
    typeof doc.result?.overallScore === "number"
      ? ` (overall score ${doc.result.overallScore}/100)`
      : ""
  }.`;
  form.scope = [
    `Review and prioritise the audit findings for ${doc.auditedUrl}.`,
    "Agree the fixes and improvements to be delivered in the first phase.",
  ];
  form.deliverables = [
    "A production deployment of the agreed fixes.",
    "A before-and-after summary of the changes made.",
    "Repository access, deployment notes, and a written handover.",
  ];
  form.selections = [{ serviceSlug: "website-development", quantity: 1 }];

  return {
    ...form,
    leadKind: kind,
    leadId: id,
    sourceNote:
      "Prefilled from the website audit. Add the client name before sending.",
  };
}
