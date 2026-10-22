import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  AUDIT_FOLLOW_UP_CONSENT_TEXT,
  auditEmailRequestSchema,
} from "@/lib/audit-email";
import { queueEmail } from "@/lib/server/email/send";
import { getSiteUrl } from "@/lib/server/env";
import { captureLead } from "@/lib/server/leads/capture";
import { notifyNewLead } from "@/lib/server/email/notify";
import { consumeRateLimit } from "@/lib/server/rate-limit";

/**
 * Emails a completed audit or review to the visitor who asked for it.
 *
 * This is a lead capture with a useful receipt, not a newsletter: the address
 * is stored with `contact` consent reflecting the (unticked by default)
 * follow-up box, and the message itself is transactional. The body is built
 * here from validated fields, so the route cannot be used to relay arbitrary
 * text to a third party.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_000;
const HOUR_MS = 60 * 60 * 1000;

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
  return createHash("sha256").update(`audit-email:${candidate}`).digest("hex");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, message: "The request is too large." }, 413);
  }

  const limit = await consumeRateLimit({
    bucket: "audit-report-email",
    key: clientKey(request),
    max: 5,
    windowMs: HOUR_MS,
  });
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        message: "Too many report emails. Please try again later.",
      },
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "Send a valid email address." }, 400);
  }

  const parsed = auditEmailRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      {
        ok: false,
        message: "Enter a valid email address and try again.",
      },
      400,
    );
  }

  const input = parsed.data;
  const host = displayHost(input.url);
  const now = new Date();

  try {
    const lead = await captureLead(
      {
        kind: "magnet",
        source: "website-audit",
        email: input.email,
        name: input.name,
        message: `Requested the website report for ${host}.`,
        consent: {
          contact: input.followUp,
          marketing: false,
          text: input.followUp ? AUDIT_FOLLOW_UP_CONSENT_TEXT : null,
        },
        attribution: input.attribution,
        detail: {
          page: input.source,
          url: input.url,
          score: input.score ?? null,
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
        source: "website-audit",
        kindLabel: "audit report request",
        name: input.name,
        email: input.email,
        message: `Requested the website report for ${host}.`,
        score: input.score ?? null,
      }).catch(() => undefined);
    }

    const attention = input.findings.filter(
      (finding) => finding.status !== "pass",
    );
    const blocks = [
      {
        type: "p" as const,
        text: `Here is the report you requested for ${host}.`,
      },
      ...(typeof input.score === "number"
        ? [
            {
              type: "p" as const,
              text: `The page scored ${input.score} out of 100 in this passive review.`,
            },
          ]
        : []),
      ...(input.summary ? [{ type: "p" as const, text: input.summary }] : []),
      ...(attention.length > 0
        ? [
            { type: "h2" as const, text: "What stands out" },
            {
              type: "ul" as const,
              items: attention.map((finding) =>
                finding.recommendation
                  ? `${finding.title}: ${finding.detail} Suggested next step: ${finding.recommendation}`
                  : `${finding.title}: ${finding.detail}`,
              ),
            },
          ]
        : [
            {
              type: "p" as const,
              text: "None of the checks in this review found a problem.",
            },
          ]),
      {
        type: "p" as const,
        text: "This is a passive look at one public page and its response headers. It is a starting point for a conversation, not a penetration test, a full crawler, or an accessibility certification.",
      },
      {
        type: "cta" as const,
        label: "Book a free 30-minute review call",
        url: `${getSiteUrl()}/book-a-call`,
      },
    ];

    const queued = await queueEmail({
      to: input.email,
      toName: input.name,
      subject: `Your website report — ${host}`,
      blocks,
      category: "transactional",
      skipApproval: true,
      track: false,
      leadId: lead.id,
      footerNote:
        "You asked for this report from the Bitecodes website audit. Reply to this message if you would like anything clarified.",
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
      "[audit-email] Could not store or queue the report:",
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
