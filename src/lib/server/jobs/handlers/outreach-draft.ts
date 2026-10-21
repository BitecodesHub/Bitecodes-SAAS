import "server-only";

import type { JobContext } from "@/lib/server/jobs/worker";
import { z } from "zod";

import { completeJson } from "@/lib/server/ai/automation";
import { getSettingsFresh } from "@/lib/server/settings";
import {
  outreachOpeningSchema,
  type OutreachOpeningOutput,
} from "@/lib/prospecting/research";
import {
  buildResearchFacts,
  type ResearchFactInput,
  type ResearchFactSheet,
} from "@/lib/prospecting/research";
import {
  getProspect,
  saveProspectOutreachDraft,
} from "@/lib/server/prospecting/repository";

const payloadSchema = z.object({ prospectId: z.string().min(1) });

/**
 * `outreach.draft` — Drafts personalised outreach for qualified prospects into the approval queue.
 *
 * Contract: return `{ skipped: "disabled" }` when
 * `settings.growth.outreachDrafts` is off, stay idempotent, respect
 * `context.deadline`, and return a small JSON summary.
 */
export async function handleOutreachDraft(
  payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Invalid outreach draft payload.");

  const { prospectId } = parsed.data;

  const settings = await getSettingsFresh();
  if (!settings.growth.outreachDrafts) {
    context.log("Outreach drafts are switched off in settings.");
    return { skipped: "disabled" };
  }

  const prospect = await getProspect(prospectId);
  if (!prospect) {
    context.log("Prospect no longer exists; nothing to draft.");
    return { skipped: "missing" };
  }

  // Already drafted — idempotent no-op.
  if (prospect.outreachDraftedAt) {
    context.log("Prospect already has a draft; skipping.");
    return { skipped: "idempotent" };
  }

  // Respect the run deadline.
  if (context.deadline && Date.now() > context.deadline) {
    context.log("Deadline exceeded before outreach draft could run.");
    return { skipped: "deadline" };
  }

  // Only qualified prospects can receive outreach drafts.
  if (prospect.status !== "qualified" && prospect.status !== "enriching") {
    context.log(
      `Prospect ${prospect.name} is not qualified (status: ${prospect.status}); skipping draft.`,
    );
    return { skipped: "not-qualified" };
  }

  // Build the fact sheet for the AI opening draft.
  const factInput: ResearchFactInput = {
    name: prospect.name,
    categoryLabel: prospect.categoryLabel,
    city: prospect.city,
    region: prospect.region,
    countryCode: prospect.countryCode,
    website: prospect.website,
    socialUrl: prospect.socialUrl,
    signals: prospect.signals,
    classification: prospect.classification,
    auditScore: prospect.auditScore,
  };

  const factSheet = buildResearchFacts(factInput);

  // Call the AI operator to draft the outreach opening.
  const providerChain = ["nvidia", "openrouter", "groq", "bedrock"];

  let modelOutput: OutreachOpeningOutput | null = null;
  let providerUsed = "";

  for (const provider of providerChain) {
    try {
      const result = await completeJson({
        purpose: "outreach-draft",
        system: buildOutreachPrompt(factSheet),
        user: "",
        schema: outreachOpeningSchema,
        temperature: 0.3,
        deadlineMs: 30_000,
        providerSilenceMs: 20_000,
      });

      modelOutput = result.data;
      providerUsed = result.provider;
      break;
    } catch (error) {
      context.log(
        `Provider ${provider} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
  }

  if (!modelOutput) {
    context.log("All AI providers failed to draft an outreach opening.");
    return { skipped: "ai-failed" };
  }

  // Persist the draft and mark the prospect as having a draft.
  await saveProspectOutreachDraft(prospectId, {
    subject: modelOutput.subject,
    opening: modelOutput.opening,
    draftedAt: new Date(),
    model: "nemotron",
    provider: providerUsed,
  });

  context.log(
    `Wrote outreach draft for ${prospect.name} (provider: ${providerUsed}, subject: "${modelOutput.subject}").`,
  );

  return {
    subject: modelOutput.subject,
    opening: modelOutput.opening,
    requiresApproval: settings.automation.requireApproval,
  };
}

function buildOutreachPrompt(factSheet: ResearchFactSheet): string {
  const { lines, segmentName } = factSheet;
  return `You are Bitecodes, a growth agency assistant. Write a personalised outreach opening (subject + 2-3 sentence opening paragraph) for the business below. Ground every claim in the fact sheet lines. Do not invent numbers, links, or superlatives not present in the fact sheet. The subject must be under 160 characters. The opening must be 10-600 characters.

Fact:
${lines.join("\n")}

ICP segment: ${segmentName ?? "none"}.`;
}
