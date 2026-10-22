import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  AI_FOLLOW_UP_CONSENT_TEXT,
  aiVisibilityEmailSchema,
  type AiVisibilityResult,
} from "@/lib/ai-visibility";
import { checkAiVisibility } from "@/lib/server/ai-visibility";
import { queueEmail } from "@/lib/server/email/send";
import { getSiteUrl } from "@/lib/server/env";
import { captureLead } from "@/lib/server/leads/capture";
import { notifyNewLead } from "@/lib/server/email/notify";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_000;

function displayHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return (
      value.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "your site"
    );
  }
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`ai-visibility-email:${candidate}`)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, message: "The request is too large." }, 413);
  }

  const limit = await consumeRateLimit({
    bucket: "ai-visibility-email",
    key: clientKey(request),
    max: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return json(
      { ok: false, message: "Too many report emails. Please try again later." },
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "Send a valid email address." }, 400);
  }

  const parsed = aiVisibilityEmailSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      { ok: false, message: "Enter a valid email address and try again." },
      400,
    );
  }

  const input = parsed.data;
  const now = new Date();

  // Re-run the check instead of trusting the score and fixes posted by the
  // browser. The email is a published claim about someone's site, so it must
  // come from our own scan and must not be usable as an arbitrary text relay.
  let report: AiVisibilityResult;
  try {
    report = await checkAiVisibility(input.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const blocked =
      /blocked|private|reserved|credentials|ports|hostname|http and https/i.test(
        message,
      );
    return blocked
      ? json(
          {
            ok: false,
            message:
              "This URL cannot be checked publicly. Only public websites on standard HTTP or HTTPS ports are supported.",
          },
          400,
        )
      : json(
          {
            ok: false,
            message:
              "We could not retrieve this public webpage safely. Check the URL and try again.",
          },
          502,
        );
  }

  const host = displayHost(report.finalUrl || input.url);

  try {
    const lead = await captureLead(
      {
        kind: "magnet",
        source: "ai-visibility-check",
        email: input.email,
        name: input.name,
        message: `Requested the AI visibility report for ${host}.`,
        consent: {
          contact: input.followUp,
          marketing: false,
          text: input.followUp ? AI_FOLLOW_UP_CONSENT_TEXT : null,
        },
        attribution: input.attribution,
        detail: {
          url: report.auditedUrl,
          score: report.score,
          grade: report.grade,
          followUp: input.followUp,
        },
        requestId: input.requestId ?? randomUUID(),
      },
      now,
    );

    if (lead.created) {
      await notifyNewLead({
        leadId: lead.id,
        reference: lead.reference,
        source: "ai-visibility-check",
        kindLabel: "AI visibility report request",
        name: input.name,
        email: input.email,
        message: `Requested the AI visibility report for ${host}.`,
        score: report.score,
      }).catch(() => undefined);
    }

    const queued = await queueEmail({
      to: input.email,
      toName: input.name,
      subject: `Your AI visibility report — ${host}`,
      blocks: [
        {
          type: "p",
          text: `Here is the AI visibility report you requested for ${host}.`,
        },
        {
          type: "p",
          text: `The homepage scored ${report.score} out of 100 (${report.grade}). This measures the signals an AI crawler or answer engine can read, not a ranking in any specific model.`,
        },
        ...(report.priorityFixes.length > 0
          ? [
              { type: "h2" as const, text: "The highest-value fixes" },
              {
                type: "ul" as const,
                items: report.priorityFixes.map(
                  (fix) => `${fix.title}: ${fix.detail}`,
                ),
              },
            ]
          : [
              {
                type: "p" as const,
                text: "No priority fixes were found in this pass.",
              },
            ]),
        {
          type: "p" as const,
          text:
            "Re-run the check at any time at " +
            `${getSiteUrl()}/ai-visibility-check.`,
        },
        {
          type: "cta" as const,
          label: "Book a free 30-minute review",
          url: `${getSiteUrl()}/book-a-call`,
        },
      ],
      category: "transactional",
      skipApproval: true,
      track: false,
      leadId: lead.id,
      footerNote:
        "You asked for this report from the Bitecodes AI visibility check. Reply to this message if you would like anything clarified.",
    });

    if (queued.status === "skipped") {
      return json(
        {
          ok: false,
          message:
            "That address cannot receive the report. Please try a different address.",
        },
        400,
      );
    }

    return json({ ok: true, reference: lead.reference }, 200);
  } catch (error) {
    console.error(
      "[ai-visibility-email] Could not store or queue the report:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    return json(
      {
        ok: false,
        message: "The report could not be emailed right now. Please try again.",
      },
      502,
    );
  }
}
