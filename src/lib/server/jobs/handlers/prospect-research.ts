import "server-only";

import type { JobContext } from "@/lib/server/jobs/worker";
import { z } from "zod";

import { completeJson } from "@/lib/server/ai/automation";
import { getSettingsFresh } from "@/lib/server/settings";
import {
  prospectResearchSchema,
  type ProspectResearchOutput,
  type ResearchFactSheet,
} from "@/lib/prospecting/research";
import {
  buildResearchFacts,
  type ResearchFactInput,
} from "@/lib/prospecting/research";
import {
  getProspect,
  saveProspectResearch,
} from "@/lib/server/prospecting/repository";

const payloadSchema = z.object({ prospectId: z.string().min(1) });

/**
 * `prospect.research` — Writes an AI research brief for each newly enriched prospect.
 *
 * Contract: return `{ skipped: "disabled" }` when
 * `settings.growth.prospectResearch` is off, stay idempotent, respect
 * `context.deadline`, and return a small JSON summary.
 */
export async function handleProspectResearch(
  payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Invalid research payload.");

  const { prospectId } = parsed.data;

  const settings = await getSettingsFresh();
  if (!settings.growth.prospectResearch) {
    context.log("Prospect research is switched off in settings.");
    return { skipped: "disabled" };
  }

  const prospect = await getProspect(prospectId);
  if (!prospect) {
    context.log("Prospect no longer exists; nothing to research.");
    return { skipped: "missing" };
  }

  // Already researched — idempotent no-op.
  if (prospect.research) {
    context.log("Prospect already has a research brief; skipping.");
    return { skipped: "idempotent" };
  }

  // Respect the run deadline.
  if (context.deadline && Date.now() > context.deadline) {
    context.log("Deadline exceeded before research could run.");
    return { skipped: "deadline" };
  }

  // Build the fact sheet from stored enrichment data.
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

  // Call the AI operator to write the research brief.
  const providerChain = ["nvidia", "openrouter", "groq", "bedrock"];

  let modelOutput: ProspectResearchOutput | null = null;
  let providerUsed = "";

  for (const provider of providerChain) {
    try {
      const result = await completeJson({
        purpose: "prospect-research",
        system: buildResearchPrompt(factSheet),
        user: "",
        schema: prospectResearchSchema,
        temperature: 0.2,
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
    context.log("All AI providers failed to produce a research brief.");
    return { skipped: "ai-failed" };
  }

  // Persist the research brief.
  await saveProspectResearch(prospectId, {
    ...modelOutput,
    model: "nemotron",
    provider: providerUsed,
    createdAt: new Date(),
  });

  context.log(
    `Wrote research brief for ${prospect.name} (provider: ${providerUsed}, fitScore: ${modelOutput.fitScore}).`,
  );

  const primaryTag = prospect.classification?.primaryTag ?? "no-website";

  return {
    fitScore: modelOutput.fitScore,
    summary: modelOutput.summary,
    likelyNeeds: modelOutput.likelyNeeds,
    personalizationHooks: modelOutput.personalizationHooks,
    recommendedService: modelOutput.recommendedService,
    primaryTag,
  };
}

function buildResearchPrompt(factSheet: ResearchFactSheet): string {
  const { lines, segmentName } = factSheet;
  const serviceSlugs = [
    "restaurant",
    "cafe",
    "retail",
    "consultant",
    "healthcare",
    "education",
    "construction",
  ];
  return `You are Bitecodes, a growth agency assistant. Write a concise research brief (2-3 sentences summary, 3-5 likely needs, ICP segment, fit score 0-100, up to 3 personalization hooks, up to 3 risks, and a recommended service from: ${serviceSlugs.join(", ")}) for the business below. Ground every claim in the fact sheet lines. Do not invent numbers, links, or superlatives not present in the fact sheet.

Fact:
${lines.join("\n")}

ICP segment detected: ${segmentName ?? "none"}.`;
}
