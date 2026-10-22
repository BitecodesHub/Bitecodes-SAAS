import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import { consultantRequests } from "@/lib/server/db/collections";
import {
  consultantInputSchema,
  type ConsultantResponse,
} from "@/lib/ai-consultant";
import {
  createConsultantRecommendation,
  isAiConsultantConfigured,
} from "@/lib/server/ai-provider";
import { consumeAiRateLimit } from "@/lib/server/rate-limit";
import { createDeterministicConsultantQuote } from "@/lib/server/consultant-quote";
import { captureLead } from "@/lib/server/leads/capture";
import { notifyNewLead } from "@/lib/server/email/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_096;

function json(body: ConsultantResponse, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function getClientKey(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`ai:${candidate}`).digest("hex");
}

export async function POST(request: NextRequest) {
  if (!isAiConsultantConfigured()) {
    return json(
      {
        ok: false,
        code: "NOT_CONFIGURED",
        message:
          "The AI consultant is being configured. Use the cost calculator or contact our team in the meantime.",
      },
      503,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json(
      {
        ok: false,
        code: "INVALID",
        message: "The project brief is too large.",
      },
      413,
    );
  }

  const rateLimit = await consumeAiRateLimit(getClientKey(request));
  if (!rateLimit.allowed) {
    return json(
      {
        ok: false,
        code: "RATE_LIMITED",
        message:
          "You have reached the daily consultant limit. Please contact our team for a detailed review.",
      },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(
      {
        ok: false,
        code: "INVALID",
        message: "Check the project brief and try again.",
      },
      400,
    );
  }

  const parsed = consultantInputSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      {
        ok: false,
        code: "INVALID",
        message: "Complete every project field with a little more detail.",
      },
      400,
    );
  }

  const requestId = randomUUID();
  // Contact fields are for the lead record, not for the model. Stripping them
  // here keeps an address and a consent flag out of the provider prompt and out
  // of the stored brief, while `consultantRequests.email` keeps the one field
  // the admin inbox needs.
  const {
    email: submittedEmail,
    consent: submittedConsent,
    ...brief
  } = parsed.data;
  // The schema accepts an empty string so the optional field can be cleared;
  // the lead record stores null rather than "".
  const email = submittedEmail?.trim().toLowerCase() || null;
  const consent = submittedConsent ?? false;

  try {
    const [result, quote] = await Promise.all([
      createConsultantRecommendation(brief),
      Promise.resolve(createDeterministicConsultantQuote(brief)),
    ]);

    // Persist after the response is composed but before returning, via
    // `after()` so a slow database write cannot delay the visitor. Every brief
    // is a lead: previously they were computed, shown once, and discarded.
    after(async () => {
      try {
        const collection = await consultantRequests();
        const now = new Date();
        await collection.insertOne({
          requestId,
          reference: `BC-AI-${requestId.slice(0, 8).toUpperCase()}`,
          input: brief as unknown as Record<string, unknown>,
          quote: quote as unknown as Record<string, unknown>,
          recommendation: result.recommendation as unknown as Record<
            string,
            unknown
          >,
          model: result.model,
          email: email ?? null,
          status: "new",
          notes: [],
          createdAt: now,
          updatedAt: now,
        });

        if (email) {
          // A free tool that returns a detailed recommendation is a lead, not
          // a page view. The consent box governs follow-up; the report itself
          // is the transactional reply the person asked for by entering an
          // address.
          try {
            const lead = await captureLead(
              {
                kind: "magnet",
                source: "ai-project-consultant",
                email,
                message: `Requested an AI project recommendation (${result.recommendation.recommendedPackage}).`,
                consent: {
                  contact: consent ?? false,
                  marketing: false,
                  text: consent
                    ? "I agree that Bitecodes may contact me about this project."
                    : null,
                },
                detail: {
                  requestId,
                  reference: `BC-AI-${requestId.slice(0, 8).toUpperCase()}`,
                  projectType: brief.projectType,
                  stage: brief.stage,
                  budget: brief.budget,
                  timeline: brief.timeline,
                  recommendedPackage: result.recommendation.recommendedPackage,
                  quote: {
                    minimum: quote.minimum,
                    maximum: quote.maximum,
                    currency: "INR",
                  },
                },
                requestId: `consultant:${requestId}`,
              },
              now,
            );

            if (lead.created) {
              await notifyNewLead({
                leadId: lead.id,
                reference: lead.reference,
                source: "ai-project-consultant",
                kindLabel: "AI project brief",
                email,
                message: `Recommended ${result.recommendation.recommendedPackage}.`,
              }).catch(() => undefined);
            }
          } catch (leadError) {
            console.error(
              "[consultant] Could not capture the lead:",
              leadError instanceof Error ? leadError.message : leadError,
            );
          }
        }
      } catch (error) {
        // A failed write must never turn a successful recommendation into an
        // error for the visitor. Log and move on.
        console.error(
          "[consultant] Could not persist the brief:",
          error instanceof Error ? error.message : error,
        );
      }
    });

    return json({ ok: true, ...result, quote }, 200);
  } catch {
    return json(
      {
        ok: false,
        code: "UNAVAILABLE",
        message:
          "The consultant could not create a reliable recommendation right now. Please retry or use the deterministic cost calculator.",
      },
      502,
    );
  }
}
