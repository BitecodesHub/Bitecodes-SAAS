import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import { auditReports } from "@/lib/server/db/collections";
import {
  websiteAuditInputSchema,
  type WebsiteAuditResponse,
} from "@/lib/website-audit";
import { consumeAuditRateLimit } from "@/lib/server/rate-limit";
import { AuditError, auditWebsite } from "@/lib/server/website-auditor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_048;

function json(
  body: WebsiteAuditResponse,
  status: number,
  headers?: HeadersInit,
) {
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
  return createHash("sha256").update(`audit:${candidate}`).digest("hex");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json(
      { ok: false, code: "INVALID", message: "The request is too large." },
      413,
    );
  }

  const rateLimit = await consumeAuditRateLimit(getClientKey(request));
  if (!rateLimit.allowed) {
    return json(
      {
        ok: false,
        code: "RATE_LIMITED",
        message:
          "You have reached the hourly audit limit. Please try again later.",
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
      { ok: false, code: "INVALID", message: "Enter a valid website URL." },
      400,
    );
  }

  const parsed = websiteAuditInputSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      { ok: false, code: "INVALID", message: "Enter a valid website URL." },
      400,
    );
  }

  try {
    const result = await auditWebsite(parsed.data.url);

    // Every audit run is a signal of intent worth keeping: someone typed their
    // own domain into a stranger's tool. Written after the response so the
    // visitor never waits on the database, and never fatal.
    after(async () => {
      try {
        const collection = await auditReports();
        const now = new Date();
        let hostname = "";
        try {
          hostname = new URL(result.finalUrl).hostname.toLowerCase();
        } catch {
          hostname = "";
        }

        await collection.insertOne({
          requestId: randomUUID(),
          auditedUrl: result.auditedUrl,
          hostname,
          result,
          email: null,
          source: "public-tool",
          shareId: null,
          status: "new",
          notes: [],
          createdAt: now,
          updatedAt: now,
        });
      } catch (persistError) {
        console.error(
          "[website-audit] Could not persist the run:",
          persistError instanceof Error ? persistError.message : persistError,
        );
      }
    });

    return json({ ok: true, result }, 200);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The website could not be audited.";
    // Prefer the typed reason. The message regex remains as a fallback because
    // `normalizeAuditUrl` rejects malformed URLs and non-standard ports with a
    // plain Error before the auditor's own typed failures come into play.
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
          ? "This URL is not eligible for the public audit. Only public websites on standard HTTP or HTTPS ports are supported."
          : "We could not retrieve this public webpage safely. Check the URL and try again.",
      },
      blocked ? 400 : 502,
    );
  }
}
