import "server-only";

import {
  auditSummaryInputSchema,
  auditSummaryOutputSchema,
  buildFallbackAuditSummary,
  type AuditSummaryInput,
} from "@/lib/audit-summary";
import { completeJson, untrusted } from "@/lib/server/ai/automation";

/**
 * Writes a plain-language summary of a website audit or review.
 *
 * The hard rule is honesty: the model is given the findings and nothing else,
 * and is told that inventing an issue, a cause, a price, or a timeline is worse
 * than writing a dull summary. Any failure — AI switched off, no provider,
 * timeout, invalid output — quietly returns the deterministic summary, because
 * the visitor has already waited for the audit and must never be shown an error
 * where a useful sentence belongs.
 */

export interface AuditSummaryResult {
  summary: string;
  source: "ai" | "fallback";
}

const SYSTEM_PROMPT = [
  "You explain a website audit to a business owner in plain English.",
  "Use ONLY the findings provided. Never add, infer, guess, or repeat as new any issue, cause, score, price, timeline, or technical detail that is not in the findings.",
  "Do not tell the owner their site is insecure, broken, or losing money unless a finding says so explicitly.",
  "Write three to five short sentences, no headings, no bullet points, no markdown, no emojis, and no contractions.",
  "Start with the overall result, name the two or three most useful things to fix, and finish with one calm sentence about what the review does not cover.",
  "Do not address the reader as 'you' more than necessary and do not use hype words.",
].join(" ");

export async function generateAuditSummary(
  input: AuditSummaryInput,
): Promise<AuditSummaryResult> {
  const parsed = auditSummaryInputSchema.parse(input);
  const fallback = buildFallbackAuditSummary(parsed);

  try {
    const result = await completeJson({
      purpose: "audit-summary",
      system: SYSTEM_PROMPT,
      user: [
        `Write the summary for a ${parsed.context === "review" ? "personalised website review" : "passive website audit"}.`,
        untrusted("audit findings", {
          website: parsed.url,
          score: parsed.score ?? null,
          findings: parsed.findings,
        }),
      ].join("\n\n"),
      schema: auditSummaryOutputSchema,
      maxTokens: 400,
      temperature: 0.2,
      // The contract caps this call at twenty seconds. The per-provider
      // silence budget is shorter so one stalled provider cannot consume the
      // whole budget before the fallback is tried.
      deadlineMs: 20_000,
      providerSilenceMs: 7_000,
    });

    return { summary: result.data.summary, source: "ai" };
  } catch (error) {
    console.error(
      "[audit-summary] Falling back to the deterministic summary:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    return { summary: fallback, source: "fallback" };
  }
}
