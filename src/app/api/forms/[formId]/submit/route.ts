import type { NextRequest } from "next/server";
import { after } from "next/server";
import { getFormForPublic } from "@/lib/server/forms/repository";
import { handleSubmission } from "@/lib/server/forms/submit";
import { corsJson, preflightResponse } from "@/lib/server/forms/cors";
import { kickJobs } from "@/lib/server/jobs/worker";

/**
 * The public endpoint an embedded form posts to.
 *
 * Lives here rather than under `/api/v1` on purpose: `/api/v1` is the
 * Bearer-key surface that answers 401 without a secret key, whereas this is an
 * anonymous, cross-origin endpoint whose credential is the form's public token
 * plus its domain allowlist. It sits beside `/api/contact` for that reason.
 */
export const dynamic = "force-dynamic";

/** Bodies are small by nature; anything larger is a probe, not a submission. */
const MAX_BODY_BYTES = 32 * 1024;

function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const { formId } = await params;
  const origin = request.headers.get("origin");
  // Preflight carries no body, so the token is unavailable here. Resolve the
  // form by id alone purely to read its allowlist — no data is returned.
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const form = token ? await getFormForPublic(formId, token) : null;
  return preflightResponse(origin, form);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const { formId } = await params;
  const origin = request.headers.get("origin");

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return corsJson(
      {
        ok: false,
        code: "TOO_LARGE",
        message: "That submission is too large.",
      },
      413,
      origin,
      null,
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return corsJson(
      { ok: false, code: "INVALID", message: "Body must be a JSON object." },
      400,
      origin,
      null,
    );
  }

  const token = typeof body._token === "string" ? body._token : "";
  const form = await getFormForPublic(formId, token);
  if (!form) {
    // One answer for "no such form", "wrong token", and "paused", so the
    // endpoint cannot be used to enumerate forms or probe their state.
    return corsJson(
      {
        ok: false,
        code: "NOT_AVAILABLE",
        message: "This form is not available.",
      },
      404,
      origin,
      null,
    );
  }

  const { _token: _t, ...payload } = body;
  void _t;

  const outcome = await handleSubmission({
    form,
    payload,
    origin,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
  });

  switch (outcome.kind) {
    case "ok":
    case "ok-silent":
      // Deliver the notification promptly without holding the response.
      after(() => kickJobs(15_000));
      return corsJson(
        {
          ok: true,
          message: outcome.thankYouMessage,
          redirectUrl: outcome.redirectUrl,
        },
        201,
        origin,
        form,
      );

    case "origin-denied":
      return corsJson(
        {
          ok: false,
          code: "ORIGIN_NOT_ALLOWED",
          message:
            "This form is not enabled for this website. Add the domain in your Bitecodes dashboard.",
        },
        403,
        origin,
        form,
      );

    case "invalid":
      return corsJson(
        {
          ok: false,
          code: "INVALID",
          message: "Please check the highlighted fields.",
          fieldErrors: outcome.fieldErrors,
        },
        422,
        origin,
        form,
      );

    case "rate-limited":
      return new Response(
        JSON.stringify({
          ok: false,
          code: "RATE_LIMITED",
          message: "Too many submissions. Please try again shortly.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Retry-After": String(outcome.retryAfterSeconds),
            Vary: "Origin",
            ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
          },
        },
      );

    case "out-of-credits":
      return corsJson(
        {
          ok: false,
          code: "OWNER_OUT_OF_CREDITS",
          message:
            "This form is temporarily unavailable. The site owner has been notified.",
        },
        402,
        origin,
        form,
      );
  }
}
