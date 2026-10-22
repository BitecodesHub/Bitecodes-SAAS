import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  aiVisibilityInputSchema,
  type AiVisibilityResponse,
} from "@/lib/ai-visibility";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";
import { checkAiVisibility } from "@/lib/server/ai-visibility";
import { AuditError } from "@/lib/server/website-auditor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_048;

function json(
  body: AiVisibilityResponse,
  status: number,
  headers?: HeadersInit,
) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`ai-visibility:${candidate}`)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json(
      { ok: false, code: "INVALID", message: "The request is too large." },
      413,
    );
  }

  const limit = await consumeNamedRateLimit("aiVisibility", clientKey(request));
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: "You have reached the hourly limit. Please try again later.",
      },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(
      { ok: false, code: "INVALID", message: "Enter a valid website URL." },
      400,
    );
  }

  const parsed = aiVisibilityInputSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      { ok: false, code: "INVALID", message: "Enter a valid website URL." },
      400,
    );
  }

  try {
    const result = await checkAiVisibility(parsed.data.url);
    return json({ ok: true, result }, 200);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The check could not be completed.";
    const blocked =
      error instanceof AuditError
        ? error.reason === "blocked"
        : /blocked|private|reserved|credentials|ports|hostname|http and https/i.test(
            message,
          );
    return json(
      {
        ok: false,
        code: blocked ? "BLOCKED" : "UNAVAILABLE",
        message: blocked
          ? "This URL cannot be checked publicly. Only public websites on standard HTTP or HTTPS ports are supported."
          : "We could not retrieve this public webpage safely. Check the URL and try again.",
      },
      blocked ? 400 : 502,
    );
  }
}
