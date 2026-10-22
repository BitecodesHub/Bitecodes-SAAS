import "server-only";

import type { JobContext } from "@/lib/server/jobs/worker";
import { z } from "zod";

import { getSettingsFresh } from "@/lib/server/settings";
import { runProspectResearch } from "@/lib/server/prospecting/research";
import {
  getProspect,
  listProspectsAwaitingResearch,
  saveProspectResearch,
} from "@/lib/server/prospecting/repository";
import type { ProspectDoc } from "@/lib/server/db/types";

/**
 * The scheduled job carries `{ date }` (from the cadence registry); an
 * operator-triggered run may carry `{ prospectId }`. Accepting only the id made
 * every scheduled run throw.
 */
const payloadSchema = z.object({
  prospectId: z.string().min(1).optional(),
  date: z.string().max(40).optional(),
});

/** A bounded batch: each brief is an AI call that can take tens of seconds. */
const MAX_RESEARCH_PER_RUN = 10;
/** Don't start a call without enough run budget left to finish it. */
const MIN_AI_BUDGET_MS = 25_000;

/**
 * `prospect.research` — Writes an AI research brief for each newly enriched
 * prospect.
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

  const settings = await getSettingsFresh();
  if (!settings.growth.prospectResearch) {
    context.log("Prospect research is switched off in settings.");
    return { skipped: "disabled" };
  }

  const { prospectId } = parsed.data;
  if (prospectId) {
    const prospect = await getProspect(prospectId);
    if (!prospect) {
      context.log("Prospect no longer exists; nothing to research.");
      return { skipped: "missing" };
    }

    return researchOne(prospect, context);
  }

  const candidates = await listProspectsAwaitingResearch(MAX_RESEARCH_PER_RUN);
  const summary: {
    candidates: number;
    researched: number;
    skipped: Record<string, number>;
  } = { candidates: candidates.length, researched: 0, skipped: {} };

  for (const prospect of candidates) {
    if (context.deadline && Date.now() + MIN_AI_BUDGET_MS > context.deadline) {
      summary.skipped.deadline = (summary.skipped.deadline ?? 0) + 1;
      context.log(
        "Run deadline reached; leaving remaining prospects for the next run.",
      );
      break;
    }

    const result = await researchOne(prospect, context);
    if (result.researched) {
      summary.researched += 1;
    } else {
      summary.skipped[result.skipped] =
        (summary.skipped[result.skipped] ?? 0) + 1;
    }
  }

  return summary;
}

type ResearchOutcome =
  | {
      researched: true;
      fitScore: number;
      summary: string;
      likelyNeeds: string[];
      personalizationHooks: string[];
      recommendedService: string | null;
      primaryTag: string;
    }
  | { researched: false; skipped: string };

async function researchOne(
  prospect: ProspectDoc,
  context: JobContext,
): Promise<ResearchOutcome> {
  if (prospect.research) {
    context.log(`${prospect.name} already has a research brief; skipping.`);
    return { researched: false, skipped: "idempotent" };
  }

  const id = prospect._id?.toHexString();
  if (!id) {
    context.log("Prospect has no id; skipping research.");
    return { researched: false, skipped: "missing" };
  }

  if (context.deadline && Date.now() > context.deadline - 5_000) {
    context.log("Deadline exceeded before research could run.");
    return { researched: false, skipped: "deadline" };
  }

  const deadlineMs = context.deadline
    ? Math.min(30_000, Math.max(5_000, context.deadline - Date.now() - 5_000))
    : 30_000;

  let brief: Awaited<ReturnType<typeof runProspectResearch>>;
  try {
    brief = await runProspectResearch(prospect, { deadlineMs });
  } catch (error) {
    context.log(
      `AI provider failed for ${prospect.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { researched: false, skipped: "ai-failed" };
  }

  await saveProspectResearch(id, brief);

  context.log(
    `Wrote research brief for ${prospect.name} (provider: ${brief.provider}, fitScore: ${brief.fitScore}).`,
  );

  return {
    researched: true,
    fitScore: brief.fitScore,
    summary: brief.summary,
    likelyNeeds: brief.likelyNeeds,
    personalizationHooks: brief.personalizationHooks,
    recommendedService: brief.recommendedService,
    primaryTag: prospect.classification?.primaryTag ?? "no-website",
  };
}
