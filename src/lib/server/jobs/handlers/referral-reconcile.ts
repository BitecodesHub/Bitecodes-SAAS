import type { JobContext } from "@/lib/server/jobs/worker";
import { reconcileReferralRewards } from "@/lib/server/referrals";

/**
 * Pays referral rewards that qualified but were never marked rewarded.
 *
 * The verification request pays inline, so this job normally finds nothing. It
 * exists for the one failure that inline payment cannot survive: the process
 * dying (or the database write failing) after `qualifiedAt` was set, which
 * would otherwise leave a referrer permanently unpaid with no retry.
 */
export async function handleReferralReconcile(
  _payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const summary = await reconcileReferralRewards();
  context.log(
    `Referral reconciliation: ${summary.rewarded} rewarded, ${summary.failed} failed, ${summary.checked} checked.`,
  );
  return summary as unknown as Record<string, unknown>;
}
