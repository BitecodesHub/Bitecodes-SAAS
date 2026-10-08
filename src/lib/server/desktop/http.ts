import "server-only";

import { hashIp } from "@/lib/server/crypto";

/** Shared JSON helpers for the /api/v1/desktop surface. */

export function desktopJson(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

export function clientIpKey(request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return hashIp(ip) ?? "unknown";
}

/** Reads a small JSON object body; null for anything else. */
export async function readJsonObject(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    const parsed = JSON.parse(text || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function bearerToken(request: Request): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(
    (request.headers.get("authorization") ?? "").trim(),
  );
  return m?.[1]?.trim() || null;
}

/**
 * Who is calling, for the activity log: the app build it reports (sanitised —
 * it is client-controlled) and a hashed IP. The raw IP is never stored.
 */
export function clientContext(request: Request): {
  client: string | null;
  ipHash: string | null;
} {
  const raw = request.headers.get("x-notes-client") ?? "";
  const client =
    raw
      .replace(/[^\w .;:()/,+-]/g, "")
      .trim()
      .slice(0, 100) || null;
  const ipHash = clientIpKey(request);
  return { client, ipHash: ipHash === "unknown" ? null : ipHash };
}

/** Approximate location from Vercel's edge geo headers, e.g. "Sydney, NSW, AU". */
export function requestLocation(request: Request): string | null {
  const h = request.headers;
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return (
        decodeURIComponent(v)
          .replace(/[^\p{L}\p{N} .'-]/gu, "")
          .slice(0, 60) || null
      );
    } catch {
      return null;
    }
  };
  const parts = [
    decode(h.get("x-vercel-ip-city")),
    decode(h.get("x-vercel-ip-country-region")),
    decode(h.get("x-vercel-ip-country")),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
