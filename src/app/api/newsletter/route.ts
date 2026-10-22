import { createHash } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { subscribeToNewsletter } from "@/lib/server/newsletter/subscribe";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  consent: z
    .boolean()
    .refine((v) => v === true, { message: "Consent is required." }),
  source: z.string().max(100).optional().default("blog-post"),
});

function clientKey(request: NextRequest): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ip = forwarded ?? request.headers.get("x-real-ip") ?? "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  // Rate limit by IP: 5 requests per hour (reuses the named newsletter limit).
  const key = clientKey(request);
  const limit = await consumeNamedRateLimit("newsletter", key);
  if (!limit.allowed) {
    return json(
      { ok: false, error: "Too many requests. Please try again later." },
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Please check the fields.";
    return json({ ok: false, error: message }, 400);
  }

  const { email, consent, source } = parsed.data;

  const result = await subscribeToNewsletter({ email, source, consent });

  return json({ ok: true, status: result.status }, 200);
}
