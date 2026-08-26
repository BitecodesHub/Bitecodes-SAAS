import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_024;

/**
 * SHA-256 of the shared early-access password. Only the digest lives in this
 * (public) repository; the plaintext is handed out by the team. This is a
 * distribution gate for a free installer, not an authentication system —
 * everyone who receives the password shares one string — so the goal is to
 * keep the build off casual crawlers and hotlinks, not to resist a determined
 * attacker. Rotate by replacing this digest.
 */
const PASSWORD_SHA256 =
  "5a5cc6c0b44678aafa53871da85541fb8cf500abf5c3f856def10c843d7b334e";

/**
 * The installers are GitHub release assets rather than files in `public/`
 * because at 104–239 MB they exceed both GitHub's 100 MB in-repo file limit
 * and Vercel's static deployment ceiling. The URLs are only revealed after
 * the password check passes.
 */
const RELEASE_BASE =
  "https://github.com/BitecodesHub/Bitecodes-SAAS/releases/download/notes-v1.1.0";

const INSTALLER_URLS = {
  windows: `${RELEASE_BASE}/Notes-Setup-1.1.0.exe`,
  macIntel: `${RELEASE_BASE}/Notes-1.1.0.dmg`,
  macArm64: `${RELEASE_BASE}/Notes-1.1.0-arm64.dmg`,
} as const;

const bodySchema = z.object({
  password: z.string().min(1).max(256),
});

export interface NotesDownloadResponse {
  ok: boolean;
  code?: "INVALID" | "WRONG_PASSWORD" | "RATE_LIMITED";
  message?: string;
  urls?: typeof INSTALLER_URLS;
}

function json(body: NotesDownloadResponse, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function getClientKey(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(candidate).digest("hex");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, code: "INVALID" }, 413);
  }

  const rateLimit = await consumeNamedRateLimit(
    "notesDownload",
    getClientKey(request),
  );
  if (!rateLimit.allowed) {
    return json(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: "Too many attempts. Please try again later.",
      },
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, code: "INVALID" }, 400);
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return json({ ok: false, code: "INVALID" }, 400);
  }

  const attempt = createHash("sha256")
    .update(parsed.data.password)
    .digest("hex");
  const matches = timingSafeEqual(
    Buffer.from(attempt, "hex"),
    Buffer.from(PASSWORD_SHA256, "hex"),
  );
  if (!matches) {
    return json(
      {
        ok: false,
        code: "WRONG_PASSWORD",
        message: "That password is not right. Check it and try again.",
      },
      401,
    );
  }

  return json({ ok: true, urls: INSTALLER_URLS }, 200);
}
