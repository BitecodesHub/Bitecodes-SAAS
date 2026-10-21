import { z } from "zod";

/**
 * The gated checklist request, shared by the form and the API route.
 *
 * Two independent consent flags, both unticked by default:
 *  - `followUp` allows a human reply about the guide itself.
 *  - `newsletter` subscribes to the newsletter through the content-engine
 *    package's double opt-in flow.
 * Asking for the checklist is the transactional request; neither flag is a
 * condition of receiving it.
 */

export const resourceRequestSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    email: z.string().trim().toLowerCase().email().max(254),
    name: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((value) => value || null),
    followUp: z.boolean().default(false),
    newsletter: z.boolean().default(false),
    attribution: z.unknown().optional(),
    /** Lets a retried submission reuse the lead instead of duplicating it. */
    requestId: z.string().trim().min(8).max(64).optional(),
  })
  .strict();

export type ResourceRequestInput = z.input<typeof resourceRequestSchema>;

export const RESOURCE_FOLLOW_UP_CONSENT_TEXT =
  "I am happy for Bitecodes to follow up about this guide.";

export const RESOURCE_NEWSLETTER_CONSENT_TEXT =
  "Send me the occasional Bitecodes newsletter about websites, software, and practical AI. I can unsubscribe at any time.";

export interface ResourceChecklistResponse {
  ok: true;
  checklist: {
    title: string;
    items: string[];
  };
  resource: {
    title: string;
    slug: string;
  };
}
