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
} from "@/lib/server/openrouter";
import { consumeAiRateLimit } from "@/lib/server/rate-limit";
import { createDeterministicConsultantQuote } from "@/lib/server/consultant-quote";

/** Reads an email from the brief without assuming the field exists. */
function readEmail(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return null;
  const value = (input as { email?: unknown }).email;
  return typeof value === "string" && value.includes("@")
    ? value.trim().toLowerCase().slice(0, 254)
    : null;
}

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

  try {
    const [result, quote] = await Promise.all([
      createConsultantRecommendation(parsed.data),
      Promise.resolve(createDeterministicConsultantQuote(parsed.data)),
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
          input: parsed.data as unknown as Record<string, unknown>,
          quote: quote as unknown as Record<string, unknown>,
          recommendation: result.recommendation as unknown as Record<
            string,
            unknown
          >,
          model: result.model,
          email: readEmail(parsed.data),
          status: "new",
          notes: [],
          createdAt: now,
          updatedAt: now,
        });
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
