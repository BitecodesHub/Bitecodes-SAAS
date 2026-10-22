import { z } from "zod";

/**
 * Plain-language audit summaries, shared by the public audit tool and the
 * personalised report page.
 *
 * The deterministic builder is the floor: it turns exactly the findings that
 * were produced into short sentences, with no model involved. The AI version is
 * an improvement on the wording, never a second opinion — its prompt contains
 * only these findings and tells the model that adding a finding is a failure.
 */

export const auditSummaryFindingSchema = z
  .object({
    status: z.enum(["pass", "warning", "fail"]),
    title: z.string().trim().min(1).max(200),
    detail: z.string().trim().min(1).max(800),
    recommendation: z.string().trim().max(600).optional(),
  })
  .strict();

export const auditSummaryInputSchema = z
  .object({
    /** The page reviewed, shown as a hostname where possible. */
    url: z.string().trim().min(3).max(500),
    score: z.number().int().min(0).max(100).nullable().optional(),
    /**
     * "audit" is the public passive scan; "review" is the personalised report
     * built from a prospect's site. The summary wording differs slightly, but
     * both use the same rules: only what is listed.
     */
    context: z.enum(["audit", "review"]).default("audit"),
    findings: z.array(auditSummaryFindingSchema).max(40),
  })
  .strict();

export type AuditSummaryFinding = z.infer<typeof auditSummaryFindingSchema>;
export type AuditSummaryInput = z.input<typeof auditSummaryInputSchema>;
export type ParsedAuditSummaryInput = z.output<typeof auditSummaryInputSchema>;

export const auditSummaryOutputSchema = z
  .object({
    summary: z.string().trim().min(40).max(900),
  })
  .strict();

export type AuditSummaryOutput = z.infer<typeof auditSummaryOutputSchema>;

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "this page";
  }
}

function sentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

function listForSentence(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * A summary built only from the findings, used when AI is switched off, not
 * configured, slow, or returns something invalid. It reads like a person
 * summarising a checklist, not like a second audit.
 */
export function buildFallbackAuditSummary(input: AuditSummaryInput): string {
  const parsed = auditSummaryInputSchema.parse(input);
  const host = displayHost(parsed.url);
  const failures = parsed.findings.filter((f) => f.status === "fail");
  const warnings = parsed.findings.filter((f) => f.status === "warning");
  const passes = parsed.findings.filter((f) => f.status === "pass");
  const attention = [...failures, ...warnings];

  const opening =
    typeof parsed.score === "number"
      ? `This review of ${host} scored ${parsed.score} out of 100.`
      : `This review looked at ${host}.`;

  if (attention.length === 0) {
    const passed =
      passes.length > 0
        ? `${passes.length} ${passes.length === 1 ? "check" : "checks"} passed.`
        : "No problems were recorded in the checks that ran.";
    return `${opening} ${passed} The checks cover one public page and its response headers, so they are a starting point rather than a full audit.`;
  }

  const first = attention[0];
  const titles = attention.slice(0, 4).map((f) => f.title.toLowerCase());
  const remainder =
    attention.length > 4
      ? `, plus ${attention.length - 4} more ${attention.length - 4 === 1 ? "item" : "items"}`
      : "";

  const firstDetail = first.detail.trim();
  const recommendation = first.recommendation?.trim();

  return [
    opening,
    `${attention.length} ${attention.length === 1 ? "item needs" : "items need"} attention: ${listForSentence(titles)}${remainder}.`,
    passes.length > 0
      ? `${passes.length} ${passes.length === 1 ? "check" : "checks"} passed.`
      : "",
    `${sentence(first.title)} ${firstDetail}`,
    recommendation ? `${sentence(recommendation)}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 900);
}
