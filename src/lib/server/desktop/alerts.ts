import "server-only";

import { after } from "next/server";
import { desktopAlerts, desktopPromptLog } from "@/lib/server/db/collections";
import { getServerEnv, getSiteUrl } from "@/lib/server/env";
import { emailShell, escapeHtml } from "@/lib/email/template";
import { getTransporter } from "@/lib/server/email/transport";
import type { DesktopProviderId } from "@/lib/server/db/types";

/**
 * Operator alerts for the desktop app's Bitecodes model, by email to the
 * site's notification address:
 *   - outage: a request failed after every provider was tried (or none is
 *     configured) — users are getting "could not answer";
 *   - error rate: half or more of the last 15 minutes' requests failed.
 * Each kind is throttled (one email per window) so a bad hour is one email,
 * not hundreds. Alerting never throws into a request.
 */

const OUTAGE_EVERY_MS = 30 * 60 * 1000;
const ERROR_RATE_EVERY_MS = 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MIN_REQUESTS = 10;
const RATE_THRESHOLD = 0.5;

/** Claims the right to send `kind` now; false if one went out within `everyMs`. */
async function claim(
  kind: string,
  everyMs: number,
  detail: string,
  now = new Date(),
): Promise<boolean> {
  const col = await desktopAlerts();
  const cutoff = new Date(now.getTime() - everyMs);
  const updated = await col.updateOne(
    { _id: kind, lastSentAt: { $lt: cutoff } },
    { $set: { lastSentAt: now, lastDetail: detail } },
  );
  if (updated.modifiedCount === 1) return true;
  try {
    await col.insertOne({ _id: kind, lastSentAt: now, lastDetail: detail });
    return true;
  } catch {
    return false; // exists and was sent recently (or a parallel request won)
  }
}

async function email(subject: string, lines: string[]): Promise<void> {
  const env = getServerEnv();
  const to = env.CONTACT_NOTIFICATION_TO;
  if (!to || (Array.isArray(to) && to.length === 0)) return;
  const link = `${getSiteUrl()}/admin/desktop`;
  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `[Bitecodes desktop] ${subject}`,
    text: `${lines.join("\n")}\n\nOpen the desktop admin: ${link}`,
    html: emailShell(
      `<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(subject)}</h1>` +
        lines
          .map(
            (l) =>
              `<p style="margin:0 0 8px;line-height:1.6">${escapeHtml(l)}</p>`,
          )
          .join("") +
        `<p style="margin:16px 0 0"><a href="${escapeHtml(link)}">Open the desktop admin</a></p>`,
    ),
  });
}

/** Call after a desktop request failed (not cancelled). Never throws. */
export async function noteDesktopFailure(
  code: string,
  detail: string,
  now = new Date(),
): Promise<void> {
  try {
    if (
      code === "ALL_FAILED" ||
      code === "NOT_CONFIGURED" ||
      code === "UPSTREAM_ERROR"
    ) {
      const short = detail.slice(0, 300);
      if (await claim("outage", OUTAGE_EVERY_MS, short, now)) {
        await email(
          code === "NOT_CONFIGURED"
            ? "The Bitecodes model is not configured"
            : "Desktop requests are failing on every provider",
          [
            code === "NOT_CONFIGURED"
              ? "Desktop users are being told the Bitecodes model is not available: no enabled provider has an API key."
              : "A desktop request failed after every provider in the routing chain was tried.",
            `Detail: ${short}`,
            `Time: ${now.toISOString()}`,
            "You will get at most one of these every 30 minutes.",
          ],
        );
      }
    }

    const since = new Date(now.getTime() - RATE_WINDOW_MS);
    const col = await desktopPromptLog();
    const [total, errors] = await Promise.all([
      col.countDocuments({
        createdAt: { $gte: since },
        status: { $in: ["ok", "error"] },
      }),
      col.countDocuments({ createdAt: { $gte: since }, status: "error" }),
    ]);
    if (total >= RATE_MIN_REQUESTS && errors / total >= RATE_THRESHOLD) {
      const pct = Math.round((errors / total) * 100);
      if (
        await claim(
          "error_rate",
          ERROR_RATE_EVERY_MS,
          `${errors}/${total}`,
          now,
        )
      ) {
        await email(
          `${pct}% of desktop requests failed in the last 15 minutes`,
          [
            `${errors} of ${total} desktop requests failed between ${since.toISOString()} and ${now.toISOString()}.`,
            "Check provider keys, credit and status on the desktop admin page.",
            "You will get at most one of these an hour.",
          ],
        );
      }
    }
  } catch (error) {
    console.error(
      "[desktop] alert failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

export interface ProviderHealthRow {
  provider: DesktopProviderId;
  attempts: number;
  succeeded: number;
  failed: number;
  lastError: string | null;
}

export interface DesktopHealth {
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastFailure: string | null;
  requests1h: number;
  errors1h: number;
  providers24h: ProviderHealthRow[];
  lastAlert: { kind: string; at: Date; detail: string } | null;
}

/** Live health summary for the admin page. */
export async function desktopHealth(now = new Date()): Promise<DesktopHealth> {
  const col = await desktopPromptLog();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [lastOk, lastErr, requests1h, errors1h, attempts, alerts] =
    await Promise.all([
      col.findOne(
        { status: "ok" },
        { sort: { createdAt: -1 }, projection: { createdAt: 1 } },
      ),
      col.findOne(
        { status: "error" },
        { sort: { createdAt: -1 }, projection: { createdAt: 1, error: 1 } },
      ),
      col.countDocuments({
        createdAt: { $gte: hourAgo },
        status: { $in: ["ok", "error"] },
      }),
      col.countDocuments({ createdAt: { $gte: hourAgo }, status: "error" }),
      col
        .aggregate<{
          _id: DesktopProviderId;
          attempts: number;
          succeeded: number;
          lastError: string | null;
        }>([
          { $match: { createdAt: { $gte: dayAgo } } },
          { $sort: { createdAt: -1 } },
          { $unwind: "$attempted" },
          {
            $group: {
              _id: "$attempted.provider",
              attempts: { $sum: 1 },
              succeeded: {
                $sum: { $cond: [{ $eq: ["$attempted.outcome", "ok"] }, 1, 0] },
              },
              lastError: {
                $first: {
                  $cond: [
                    { $eq: ["$attempted.outcome", "ok"] },
                    null,
                    "$attempted.outcome",
                  ],
                },
              },
            },
          },
        ])
        .toArray(),
      (await desktopAlerts())
        .find({})
        .sort({ lastSentAt: -1 })
        .limit(1)
        .toArray(),
    ]);
  return {
    lastSuccessAt: lastOk?.createdAt ?? null,
    lastFailureAt: lastErr?.createdAt ?? null,
    lastFailure: lastErr?.error ?? null,
    requests1h,
    errors1h,
    providers24h: attempts
      .map((a) => ({
        provider: a._id,
        attempts: a.attempts,
        succeeded: a.succeeded,
        failed: a.attempts - a.succeeded,
        lastError: a.lastError,
      }))
      .sort((a, b) => b.attempts - a.attempts),
    lastAlert: alerts[0]
      ? {
          kind: alerts[0]._id,
          at: alerts[0].lastSentAt,
          detail: alerts[0].lastDetail,
        }
      : null,
  };
}

/**
 * Runs `task` after the response has been sent (Next's after()), so alert
 * emails never delay a user's answer and are not cut off when a serverless
 * function finishes. Outside a request scope (tests, scripts) it just runs.
 */
export function runAfterResponse(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task();
  }
}
