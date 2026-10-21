import "server-only";

import type { Filter } from "mongodb";
import { z } from "zod";
import { services } from "@/data/services";
import { completeJson, untrusted } from "@/lib/server/ai/automation";
import {
  auditReports,
  consultantRequests,
  contactEnquiries,
} from "@/lib/server/db/collections";
import type {
  AuditReportDoc,
  ConsultantRequestDoc,
  ContactEnquiryDoc,
  LeadQualification,
} from "@/lib/server/db/types";
import type { JobContext } from "@/lib/server/jobs/worker";
import {
  recordLeadActivity,
  saveLeadQualification,
  saveLeadScore,
} from "@/lib/server/leads/repository";
import { scoreLead, type LeadScoreInput } from "@/lib/leads/score";
import { getSettingsFresh } from "@/lib/server/settings";

/**
 * `lead.score` — score new or changed leads and add a qualification note.
 *
 * Two deliberately separate steps:
 *
 *  1. The deterministic score is pure and always written when the toggle is
 *     on. It cannot be argued with, it costs nothing, and it is what orders the
 *     pipeline.
 *  2. The AI note is advisory. It is capped, deadline-aware, validated by Zod,
 *     and never allowed to change the score. A failed call leaves the lead
 *     scored but unqualified, which is a usable state.
 *
 * Idempotence: `scoredAt` is bumped by both the score and the qualification
 * write, so a lead only reappears after its content actually changes.
 */

const MAX_LEADS_PER_RUN = 40;
const MAX_AI_QUALIFICATIONS = 10;
const AI_RESERVE_MS = 5_000;

type ScorableLead =
  | { kind: "enquiry"; id: string; doc: ContactEnquiryDoc }
  | { kind: "consultant"; id: string; doc: ConsultantRequestDoc }
  | { kind: "audit"; id: string; doc: AuditReportDoc };

const qualificationSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  need: z.string().trim().min(1).max(300),
  budgetSignal: z.string().trim().min(1).max(200),
  timeline: z.string().trim().min(1).max(200),
  fit: z.enum(["strong", "possible", "poor"]),
  suggestedService: z.enum(
    services.map((service) => service.slug) as [string, ...string[]],
  ),
  suggestedNextAction: z.string().trim().min(1).max(240),
});

/** A changed lead is one that has never been scored, or edited since. */
const changedFilter = {
  $or: [
    { scoredAt: { $exists: false } },
    { scoredAt: null },
    {
      $expr: {
        $gt: ["$updatedAt", { $ifNull: ["$scoredAt", new Date(0)] }],
      },
    },
  ],
};

export async function handleLeadScore(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettingsFresh();
  if (!settings.growth.leadScoring) {
    context.log("Lead scoring is disabled in settings.");
    return { skipped: "disabled" };
  }

  const leads = await loadChangedLeads();
  if (leads.length === 0) {
    context.log("No changed leads.");
    return { scored: 0, qualified: 0, remaining: 0 };
  }

  let scored = 0;
  let qualified = 0;
  let qualificationFailures = 0;
  let aiSkipped = 0;
  const now = new Date();

  for (const lead of leads) {
    if (Date.now() > context.deadline - AI_RESERVE_MS) {
      context.log("Stopping before the job deadline.");
      break;
    }

    const input = toScoreInput(lead);
    const result = scoreLead(input);
    const previous = lead.doc.score ?? null;

    const saved = await saveLeadScore(
      lead.kind,
      lead.id,
      {
        score: result.score,
        grade: result.grade,
        reasons: result.reasons,
        segmentId: result.segmentId,
      },
      now,
    );
    if (!saved) continue;
    scored += 1;

    if (previous !== result.score) {
      await recordLeadActivity(
        {
          leadKind: lead.kind,
          leadId: lead.id,
          email: lead.doc.email ?? null,
          type: "scored",
          summary: `Lead score ${result.score}/100 (${result.grade})${
            result.segmentName ? ` · ${result.segmentName}` : ""
          }.`,
          detail: {
            previous,
            reasons: result.reasons,
            disqualified: result.disqualified,
          },
        },
        now,
      ).catch((error: unknown) => {
        context.log(
          `Could not record score activity for ${lead.kind}:${lead.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }

    // Re-qualify when the note predates the edit that made the lead appear here.
    const staleQualification =
      !lead.doc.qualification ||
      lead.doc.qualification.createdAt < lead.doc.updatedAt;

    if (
      !settings.growth.aiEnabled ||
      !staleQualification ||
      qualified >= MAX_AI_QUALIFICATIONS
    ) {
      if (settings.growth.aiEnabled && !staleQualification) aiSkipped += 1;
      continue;
    }

    const remaining = context.deadline - Date.now() - AI_RESERVE_MS;
    if (remaining < AI_RESERVE_MS) {
      context.log("Not enough time left for another AI qualification.");
      break;
    }

    try {
      const note = await qualify(lead, result, Math.min(30_000, remaining));
      const savedNote = await saveLeadQualification(
        lead.kind,
        lead.id,
        note,
        new Date(),
      );
      if (savedNote) qualified += 1;
    } catch (error) {
      qualificationFailures += 1;
      context.log(
        `Qualification failed for ${lead.kind}:${lead.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  context.log(
    `Scored ${scored} lead${scored === 1 ? "" : "s"}; qualified ${qualified}.`,
  );

  return {
    scored,
    qualified,
    qualificationFailures,
    aiSkipped,
    remaining: Math.max(0, leads.length - scored),
  };
}

async function loadChangedLeads(): Promise<ScorableLead[]> {
  const [enquiries, consultants, audits] = await Promise.all([
    loadEnquiries(),
    loadConsultants(),
    loadAudits(),
  ]);

  return [
    ...enquiries.map((doc) => ({
      kind: "enquiry" as const,
      id: doc._id!.toHexString(),
      doc,
    })),
    ...consultants.map((doc) => ({
      kind: "consultant" as const,
      id: doc._id!.toHexString(),
      doc,
    })),
    ...audits.map((doc) => ({
      kind: "audit" as const,
      id: doc._id!.toHexString(),
      doc,
    })),
  ]
    .sort((a, b) => timestamp(b.doc) - timestamp(a.doc))
    .slice(0, MAX_LEADS_PER_RUN);
}

async function loadEnquiries(): Promise<ContactEnquiryDoc[]> {
  try {
    const collection = await contactEnquiries();
    return await collection
      .find(changedFilter as Filter<ContactEnquiryDoc>, {
        sort: { updatedAt: -1 },
        limit: MAX_LEADS_PER_RUN,
      })
      .toArray();
  } catch {
    return [];
  }
}

async function loadConsultants(): Promise<ConsultantRequestDoc[]> {
  try {
    const collection = await consultantRequests();
    return await collection
      .find(changedFilter as Filter<ConsultantRequestDoc>, {
        sort: { updatedAt: -1 },
        limit: MAX_LEADS_PER_RUN,
      })
      .toArray();
  } catch {
    return [];
  }
}

async function loadAudits(): Promise<AuditReportDoc[]> {
  try {
    const collection = await auditReports();
    return await collection
      .find(changedFilter as Filter<AuditReportDoc>, {
        sort: { updatedAt: -1 },
        limit: MAX_LEADS_PER_RUN,
      })
      .toArray();
  } catch {
    return [];
  }
}

function timestamp(doc: { updatedAt?: Date; createdAt?: Date }): number {
  return (doc.updatedAt ?? doc.createdAt ?? new Date(0)).getTime();
}

function toScoreInput(lead: ScorableLead): LeadScoreInput {
  if (lead.kind === "enquiry") {
    const doc = lead.doc;
    return {
      name: doc.name,
      email: doc.email,
      phone: doc.phone ?? null,
      company: doc.company,
      message: doc.message,
      budget: doc.budget,
      timeline: doc.timeline ?? null,
      country: doc.country ?? null,
      source: doc.source,
      kind: doc.kind ?? "form",
    };
  }

  if (lead.kind === "consultant") {
    const doc = lead.doc;
    const input = doc.input as Record<string, unknown>;
    return {
      name: readString(input.name),
      email: doc.email ?? readString(input.email),
      phone: readString(input.phone),
      company: readString(input.company),
      message: [
        readString(input.description),
        readString(input.projectType),
        readString(input.goals),
      ]
        .filter(Boolean)
        .join(" "),
      budget: readString(input.budget),
      timeline: readString(input.timeline) ?? doc.timeline ?? null,
      country: readString(input.country) ?? doc.country ?? null,
      source: "ai-consultant",
      kind: "consultant",
    };
  }

  const doc = lead.doc;
  return {
    name: null,
    email: doc.email,
    phone: null,
    company: null,
    message: [
      doc.auditedUrl,
      doc.hostname,
      ...(doc.result?.findings ?? []).flatMap((finding) => [
        finding.title,
        finding.detail,
      ]),
    ]
      .filter(Boolean)
      .join(" "),
    budget: null,
    timeline: null,
    country: doc.country ?? null,
    source: doc.source ?? "public-tool",
    kind: "audit",
  };
}

async function qualify(
  lead: ScorableLead,
  score: ReturnType<typeof scoreLead>,
  deadlineMs: number,
): Promise<LeadQualification> {
  const system = [
    "You qualify inbound leads for Bitecodes, a software studio serving India and Australia.",
    "Return one JSON object with exactly the requested fields. Be conservative and specific.",
    "Never invent a budget, a deadline, or a requirement that is not in the lead data.",
    "If a field is unknown, say so in a few words instead of guessing.",
    "Choose suggestedService from this list of slugs:",
    services.map((service) => `${service.slug} (${service.title})`).join(", "),
  ].join("\n");

  const user = [
    "Qualify this lead. The deterministic score is context, not something to copy.",
    `Deterministic score: ${score.score}/100 (${score.grade}), fit: ${score.fit}.`,
    untrusted("lead", promptPayload(lead)),
  ].join("\n\n");

  const result = await completeJson({
    purpose: "lead-score",
    system,
    user,
    schema: qualificationSchema,
    deadlineMs,
  });

  return {
    ...result.data,
    model: result.model,
    provider: result.provider,
    createdAt: new Date(),
  } as LeadQualification;
}

function promptPayload(lead: ScorableLead): Record<string, unknown> {
  if (lead.kind === "enquiry") {
    return {
      name: lead.doc.name,
      company: lead.doc.company,
      email: lead.doc.email,
      phone: lead.doc.phone,
      message: lead.doc.message,
      budget: lead.doc.budget,
      timeline: lead.doc.timeline,
      country: lead.doc.country,
      source: lead.doc.source,
    };
  }
  if (lead.kind === "consultant") {
    return {
      email: lead.doc.email,
      brief: lead.doc.input,
      quote: lead.doc.quote,
    };
  }
  return {
    email: lead.doc.email,
    url: lead.doc.auditedUrl,
    hostname: lead.doc.hostname,
    result: lead.doc.result,
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
