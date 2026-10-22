"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCapability } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { runBootstrap, type BootstrapReport } from "@/lib/server/bootstrap";

/**
 * The admin surface for first-boot reconciliation.
 *
 * First boot should never need this page — instrumentation runs it at server
 * start and the cron heartbeat retries it daily. It exists so an operator can
 * answer "what would a fresh boot do to this database?" before a reset, and so
 * a deployment whose instrumentation log was missed can be reconciled on
 * demand with an audit entry naming who asked.
 */

const inputSchema = z.object({
  dryRun: z.boolean(),
  force: z.boolean(),
});

export type BootstrapActionResult =
  | { ok: true; report: BootstrapReport }
  | { ok: false; error: string; report?: BootstrapReport };

export async function runBootstrapAction(
  input: unknown,
): Promise<BootstrapActionResult> {
  const session = await assertCapability("manage_settings");

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid bootstrap request." };
  }

  try {
    const report = await runBootstrap({
      dryRun: parsed.data.dryRun,
      force: parsed.data.force,
      source: parsed.data.dryRun ? "admin-dry-run" : "admin",
    });

    await recordAudit({
      action: AUDIT_ACTIONS.bootstrapReconciled,
      actorId: session.userId,
      target: { type: "bootstrap", id: "site" },
      detail: {
        dryRun: report.dryRun,
        force: parsed.data.force,
        ok: report.ok,
        reconciled: report.reconciled,
        presetsCreated: report.presets.created,
        errors: report.errors,
      },
    });

    if (!report.dryRun) {
      revalidatePath("/admin/growth");
      revalidatePath("/admin");
      revalidatePath("/admin/customers/discover");
    }

    return report.ok
      ? { ok: true, report }
      : {
          ok: false,
          error:
            report.errors[0] ??
            "The bootstrap could not complete; see the report for details.",
          report,
        };
  } catch (error) {
    console.error(
      "[bootstrap] Admin reconciliation failed:",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, error: "The bootstrap action failed unexpectedly." };
  }
}
