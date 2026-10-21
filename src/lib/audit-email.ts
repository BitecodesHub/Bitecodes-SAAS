import { z } from "zod";
import type { AuditSummaryFinding } from "@/lib/audit-summary";

/**
 * The "email me this report" request, validated identically in the browser
 * form and on the server. It carries structured findings rather than free
 * text: the email body is rendered from bounded fields, so the endpoint cannot
 * be turned into a way to send arbitrary prose to a stranger.
 */

export const auditEmailFindingSchema = z
  .object({
    status: z.enum(["pass", "warning", "fail"]),
    title: z.string().trim().min(1).max(200),
    detail: z.string().trim().min(1).max(800),
    recommendation: z.string().trim().max(600).optional(),
  })
  .strict();

export const auditEmailRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    name: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((value) => value || null),
    /**
     * Unticked by default. When false the lead is stored with contact consent
     * false, so no follow-up sequence can enrol them later.
     */
    followUp: z.boolean().default(false),
    source: z.enum(["website-audit", "report"]),
    url: z.string().trim().min(3).max(500),
    score: z.number().int().min(0).max(100).nullable().optional(),
    /** The plain-language summary the visitor already saw. */
    summary: z.string().trim().max(1200).optional(),
    /** May be empty: an all-pass audit still has a report worth emailing. */
    findings: z.array(auditEmailFindingSchema).max(16),
    attribution: z.unknown().optional(),
    /** Lets a retried submission reuse the lead instead of duplicating it. */
    requestId: z.string().trim().min(8).max(64).optional(),
  })
  .strict();

export type AuditEmailFinding = z.infer<typeof auditEmailFindingSchema>;
export type AuditEmailRequest = z.input<typeof auditEmailRequestSchema>;

/** The consent sentence shown beside the checkbox, stored verbatim. */
export const AUDIT_FOLLOW_UP_CONSENT_TEXT =
  "I am happy for Bitecodes to follow up about this report.";

/** Maps the shared summary type onto the email schema's finding shape. */
export function toAuditEmailFindings(
  findings: {
    status: AuditSummaryFinding["status"];
    title: string;
    detail: string;
    recommendation?: string;
  }[],
): AuditSummaryFinding[] {
  return findings.filter((finding) => finding.status !== "pass").slice(0, 16);
}
