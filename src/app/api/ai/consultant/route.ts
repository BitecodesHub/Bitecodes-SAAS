import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
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

  const rateLimit = consumeAiRateLimit(getClientKey(request));
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

  try {
    const [result, quote] = await Promise.all([
      createConsultantRecommendation(parsed.data),
      Promise.resolve(createDeterministicConsultantQuote(parsed.data)),
    ]);
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
