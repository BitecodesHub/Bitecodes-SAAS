import "server-only";

import { JOB_TYPES, type JobType } from "@/lib/server/jobs/queue";
import type { JobHandler } from "@/lib/server/jobs/worker";

/**
 * The job-handler registry.
 *
 * Handlers are registered here rather than discovered, so the set of work the
 * worker can perform is explicit and reviewable in one place. A job whose type
 * has no entry is dead-lettered immediately rather than retried — see
 * `runDueJobs`.
 *
 * Handler modules are imported lazily inside each entry so that pulling in the
 * worker does not pull in every provider client, mailer, and audit path.
 */

const registry: Partial<Record<JobType, JobHandler>> = {};

/** Registers a handler. Later registrations for the same type replace earlier. */
export function registerJobHandler(type: JobType, handler: JobHandler) {
  registry[type] = handler;
}

export function getJobHandlers(): Partial<Record<JobType, JobHandler>> {
  ensureHandlersRegistered();
  return registry;
}

let registered = false;

function ensureHandlersRegistered() {
  if (registered) return;
  registered = true;

  registerJobHandler(JOB_TYPES.emailSend, async (payload, context) => {
    const { handleEmailSend } =
      await import("@/lib/server/jobs/handlers/email-send");
    return handleEmailSend(payload, context);
  });

  registerJobHandler(JOB_TYPES.prospectDiscover, async (payload, context) => {
    const { handleProspectDiscover } =
      await import("@/lib/server/jobs/handlers/prospect-discover");
    return handleProspectDiscover(payload, context);
  });

  registerJobHandler(JOB_TYPES.sequenceTick, async (_payload, context) => {
    const { tickSequences } = await import("@/lib/server/email/sequences");
    const summary = await tickSequences();
    context.log(
      `${summary.due} due, ${summary.sent} sent, ${summary.completed} completed, ${summary.stopped} stopped.`,
    );
    return summary as unknown as Record<string, unknown>;
  });

  registerJobHandler(JOB_TYPES.prospectEnrich, async (payload, context) => {
    const { handleProspectEnrich } =
      await import("@/lib/server/jobs/handlers/prospect-enrich");
    return handleProspectEnrich(payload, context);
  });
}

/** Test seam: forget registrations so a suite can install its own. */
export function resetJobHandlers() {
  registered = false;
  for (const key of Object.keys(registry)) {
    delete registry[key as JobType];
  }
}
