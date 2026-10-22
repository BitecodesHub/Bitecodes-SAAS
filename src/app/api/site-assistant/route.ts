import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";
import { resolveAutomationChain } from "@/lib/server/desktop/providers";
import { runTextChain } from "@/lib/server/desktop/gateway";
import { siteConfig } from "@/lib/site";
import { services } from "@/data/services";
import { faqs } from "@/data/faqs";
import { offerPackages } from "@/data/offers";

/**
 * The site-wide assistant.
 *
 * Public by definition, so it is deliberately narrow: short questions, short
 * answers, a strict per-IP budget, and a system prompt built from the same
 * service/pricing/FAQ data the pages render. That grounding matters in both
 * directions — it keeps the model from inventing a price, and it means the
 * assistant can be useful with no per-customer setup.
 *
 * When no provider is configured the endpoint answers 503 rather than
 * pretending to think; the UI falls back to the contact and booking paths.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_000;
const MAX_PROMPT_CHARS = 600;

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
  return createHash("sha256").update(`assistant:${candidate}`).digest("hex");
}

/**
 * The facts the assistant may use, kept compact so the prompt stays cheap and
 * the model has less room to wander. Every line is derived from site data
 * rather than typed a second time.
 */
function knowledge() {
  const serviceLines = services
    .slice(0, 12)
    .map((service) => `- ${service.title}: ${service.tagline}`)
    .join("\n");

  const pricingLines = offerPackages
    .map((pack) => `- ${pack.name}: from $${pack.priceUSD} (${pack.summary})`)
    .join("\n");

  const faqLines = faqs
    .slice(0, 10)
    .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
    .join("\n");

  return [
    `Company: ${siteConfig.name} — ${siteConfig.tagline}`,
    `Description: ${siteConfig.description}`,
    `Markets: ${siteConfig.markets.join(", ")}`,
    `Contact: ${siteConfig.contact.email}, ${siteConfig.contact.phone}`,
    "",
    "Services:",
    serviceLines,
    "",
    "Packages:",
    pricingLines,
    "",
    "Frequently asked:",
    faqLines,
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, message: "Please keep the question short." }, 413);
  }

  const limit = await consumeNamedRateLimit(
    "siteAssistant",
    clientKey(request),
  );
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        message:
          "You have asked a lot in a short time. Book a call or email us and we will pick it up there.",
        fallback: true,
      },
      429,
    );
  }

  let payload: unknown;
  try {
    const body = await request.text();
    // A chunked request may omit content-length, so the ceiling is enforced on
    // the body itself as well.
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
      return json(
        { ok: false, message: "Please keep the question short." },
        413,
      );
    }
    payload = JSON.parse(body);
  } catch {
    return json({ ok: false, message: "Send a question." }, 400);
  }

  const prompt =
    payload && typeof payload === "object"
      ? (payload as { prompt?: unknown }).prompt
      : undefined;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return json({ ok: false, message: "Send a question." }, 400);
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return json(
      { ok: false, message: "Please keep the question under 600 characters." },
      400,
    );
  }

  const chain = await resolveAutomationChain();
  if (chain.length === 0) {
    return json(
      {
        ok: false,
        message:
          "The assistant is offline right now. Book a free call or send us a message and a person will reply.",
        fallback: true,
      },
      503,
    );
  }

  const system = [
    "You are the Bitecodes website assistant.",
    "Answer only from the facts below. If a question is not covered, say so and point to /contact or /book-a-call.",
    "Never invent prices, timelines, client names, or guarantees.",
    "Be concise: at most 90 words, plain text, no markdown headings.",
    "If the person is describing a project, invite them to book a free 30-minute call.",
    "",
    knowledge(),
  ].join("\n");

  try {
    const result = await runTextChain(chain, {
      system,
      prompt: prompt.trim(),
      maxTokens: 320,
      temperature: 0.2,
    });

    return json(
      {
        ok: true,
        text: result.text.trim().slice(0, 1_200),
      },
      200,
    );
  } catch (error) {
    console.error(
      "[site-assistant] provider failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    return json(
      {
        ok: false,
        message:
          "The assistant could not answer right now. Book a call or send us a message instead.",
        fallback: true,
      },
      502,
    );
  }
}
