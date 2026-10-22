import "server-only";

import type { JobContext } from "@/lib/server/jobs/worker";
import { z } from "zod";

import { getSettingsFresh } from "@/lib/server/settings";
import { draftOutreachOpening } from "@/lib/server/prospecting/research";
import {
  getProspect,
  listProspectsAwaitingOutreachDraft,
  saveProspectOutreachDraft,
} from "@/lib/server/prospecting/repository";
import type { ProspectDoc } from "@/lib/server/db/types";

/**
 * The scheduled job carries `{ date }` (from the cadence registry); an
 * operator-triggered run may carry `{ prospectId }`. Both shapes are valid —
 * requiring a single id is what previously made every scheduled run throw.
 */
const payloadSchema = z.object({
  prospectId: z.string().min(1).optional(),
  date: z.string().max(40).optional(),
});

/** A bounded batch: each draft is an AI call that can take tens of seconds. */
const MAX_DRAFTS_PER_RUN = 10;
/** Don't start a call without enough run budget left to finish it. */
const MIN_AI_BUDGET_MS = 25_000;

/**
 * `outreach.draft` — Drafts personalised outreach for qualified prospects into
 * the approval queue.
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

  const settings = await getSettingsFresh();
  if (!settings.growth.outreachDrafts) {
    context.log("Outreach drafts are switched off in settings.");
    return { skipped: "disabled" };
  }

  const { prospectId } = parsed.data;
  if (prospectId) {
    const prospect = await getProspect(prospectId);
    if (!prospect) {
      context.log("Prospect no longer exists; nothing to draft.");
      return { skipped: "missing" };
    }

    const result = await draftOne(prospect, context);
    return {
      ...result,
      requiresApproval: settings.automation.requireApproval,
    };
  }

  // Scheduled mode: draft the best qualified candidates, newest enquiry first,
  // stopping before the run deadline so the job never loses its lock mid-call.
  const candidates =
    await listProspectsAwaitingOutreachDraft(MAX_DRAFTS_PER_RUN);
  const summary: {
    candidates: number;
    drafted: number;
    skipped: Record<string, number>;
  } = { candidates: candidates.length, drafted: 0, skipped: {} };

  for (const prospect of candidates) {
    if (context.deadline && Date.now() + MIN_AI_BUDGET_MS > context.deadline) {
      summary.skipped.deadline = (summary.skipped.deadline ?? 0) + 1;
      context.log(
        "Run deadline reached; leaving remaining drafts for the next run.",
      );
      break;
    }

    const result = await draftOne(prospect, context);
    if (result.drafted) {
      summary.drafted += 1;
    } else {
      summary.skipped[result.skipped] =
        (summary.skipped[result.skipped] ?? 0) + 1;
    }
  }

  return summary;
}

type DraftOutcome =
  | { drafted: true; subject: string; opening: string }
  | { drafted: false; skipped: string };

/**
 * Drafts one prospect, or returns why it did not.
 *
 * The subject and opening are both required: storing only one would mark the
 * prospect as drafted while leaving the operator with half a message.
 */
async function draftOne(
  prospect: ProspectDoc,
  context: JobContext,
): Promise<DraftOutcome> {
  if (prospect.outreachDraftedAt) {
    context.log(`${prospect.name} already has a draft; skipping.`);
    return { drafted: false, skipped: "idempotent" };
  }

  if (prospect.status !== "qualified" && prospect.status !== "enriching") {
    context.log(
      `${prospect.name} is not qualified (status: ${prospect.status}); skipping draft.`,
    );
    return { drafted: false, skipped: "not-qualified" };
  }

  // Research may have found a reason this business must not be contacted at
  // all (a competitor, a closed location). Spending an AI call on a draft that
  // can never be sent is wasteful and invites someone to send it anyway.
  if (prospect.research?.doNotContactReason) {
    context.log(`${prospect.name} is marked do-not-contact; skipping draft.`);
    return { drafted: false, skipped: "do-not-contact" };
  }

  const id = prospect._id?.toHexString();
  if (!id) {
    context.log("Prospect has no id; skipping draft.");
    return { drafted: false, skipped: "missing" };
  }

  if (context.deadline && Date.now() > context.deadline - 5_000) {
    context.log("Deadline exceeded before outreach draft could run.");
    return { drafted: false, skipped: "deadline" };
  }

  const deadlineMs = context.deadline
    ? Math.min(30_000, Math.max(5_000, context.deadline - Date.now() - 5_000))
    : 30_000;

  let draft: Awaited<ReturnType<typeof draftOutreachOpening>>;
  try {
    draft = await draftOutreachOpening(prospect, { deadlineMs });
  } catch (error) {
    context.log(
      `AI provider failed for ${prospect.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { drafted: false, skipped: "ai-failed" };
  }

  if (!draft.subject || !draft.opening) {
    // A claim the fact sheet cannot support is dropped, never "fixed up". The
    // prospect stays undrafted so a later run can try again.
    context.log(
      `Draft for ${prospect.name} failed grounding checks; left undrafted.`,
    );
    return { drafted: false, skipped: "ungrounded" };
  }

  await saveProspectOutreachDraft(id, {
    subject: draft.subject,
    opening: draft.opening,
    draftedAt: new Date(),
    model: draft.model,
    provider: draft.provider,
  });

  context.log(
    `Wrote outreach draft for ${prospect.name} (provider: ${draft.provider}, subject: "${draft.subject}").`,
  );

  return { drafted: true, subject: draft.subject, opening: draft.opening };
}
