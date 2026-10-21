import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sanitizeAttribution } from "@/lib/attribution";
import { contactEnquiries } from "@/lib/server/db/collections";
import { scoreLead } from "@/lib/leads/score";
import { recordLeadActivity } from "@/lib/server/leads/repository";
import type {
  ContactEnquiryDoc,
  LeadCaptureKind,
  LeadConsent,
} from "@/lib/server/db/types";

/**
 * One entry point for every inbound lead that is not the contact form: lead
 * magnets, the site assistant, callback requests, demo requests, newsletter
 * sign-ups, embedded forms, and bookings.
 *
 * Leads are stored in `contact_enquiries` (with `kind`, `consent`, and
 * `attribution`), so they appear in the existing leads inbox with no change
 * to its union query. Owned by the leads-crm package, which extends this
 * (scoring, activity timeline, notifications); keep the signature stable.
 *
 * Personal data stays in the document, never in a URL or a log line.
 */

export const LEAD_CAPTURE_KINDS = [
  "magnet",
  "chat",
  "call",
  "demo",
  "newsletter",
  "form",
  "booking",
  "prospect",
] as const satisfies readonly LeadCaptureKind[];

const DEFAULT_SUMMARY: Record<LeadCaptureKind, string> = {
  magnet: "Requested a resource.",
  chat: "Shared contact details in the website chat.",
  call: "Requested a callback.",
  demo: "Requested a demo.",
  newsletter: "Subscribed to the newsletter.",
  form: "Submitted a form.",
  booking: "Booked a call.",
  prospect: "Converted from qualified prospecting.",
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const captureLeadSchema = z
  .object({
    kind: z.enum(LEAD_CAPTURE_KINDS),
    source: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9:/._-]*$/i),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .max(254)
      .nullish()
      .transform((value) => value || null),
    name: optionalText(100),
    phone: z
      .string()
      .trim()
      .max(32)
      .regex(/^\+?[0-9 ()-]{6,32}$/)
      .nullish()
      .transform((value) => value || null),
    company: optionalText(120),
    message: optionalText(2000),
    budget: optionalText(60),
    timeline: optionalText(80),
    country: optionalText(40),
    role: optionalText(100),
    consent: z.object({
      contact: z.boolean(),
      marketing: z.boolean().default(false),
      text: optionalText(500),
    }),
    attribution: z.unknown().optional(),
    detail: z.record(z.string(), z.unknown()).nullish(),
    requestId: z.string().trim().min(8).max(64).optional(),
  })
  .refine((value) => value.email || value.phone, {
    message: "An email address or a phone number is required.",
    path: ["email"],
  });

export type CaptureLeadInput = z.input<typeof captureLeadSchema>;

export interface CaptureLeadResult {
  /** The contact_enquiries document id (the lead id in the inbox). */
  id: string;
  reference: string;
  /** False when `requestId` matched an existing lead (idempotent retry). */
  created: boolean;
}

export class LeadCaptureError extends Error {
  constructor(readonly fieldErrors: Record<string, string[]>) {
    super("The lead details are invalid.");
    this.name = "LeadCaptureError";
  }
}

/** Keeps `detail` small: bounded size, no nested functions or classes. */
function boundedDetail(
  detail: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!detail) return null;
  try {
    const json = JSON.stringify(detail);
    if (json.length > 4_000) return { truncated: true };
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Stores an inbound lead and returns its id. Throws `LeadCaptureError` for
 * invalid input. Passing the same `requestId` twice returns the first lead
 * instead of creating a duplicate.
 */
export async function captureLead(
  input: CaptureLeadInput,
  now = new Date(),
): Promise<CaptureLeadResult> {
  const parsed = captureLeadSchema.safeParse(input);
  if (!parsed.success) {
    throw new LeadCaptureError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  const lead = parsed.data;
  const requestId = lead.requestId ?? randomUUID();
  const reference = `BC-${requestId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  const consent: LeadConsent = {
    contact: lead.consent.contact,
    marketing: lead.consent.marketing,
    text: lead.consent.text,
    at: now,
  };

  const scored = scoreLead({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    message: lead.message ?? DEFAULT_SUMMARY[lead.kind],
    budget: lead.budget,
    timeline: lead.timeline,
    country: lead.country,
    source: lead.source,
    kind: lead.kind,
  });

  const document: ContactEnquiryDoc = {
    requestId,
    reference,
    // The inbox shows the name first; fall back to whatever identifies them.
    name: lead.name ?? lead.email ?? lead.phone ?? "Website visitor",
    email: lead.email ?? "",
    company: lead.company,
    budget: lead.budget,
    message: lead.message ?? DEFAULT_SUMMARY[lead.kind],
    role: lead.role,
    source: lead.source,
    status: "new",
    stage: "new",
    score: scored.score,
    grade: scored.grade,
    scoreReasons: scored.reasons,
    scoredAt: now,
    timeline: lead.timeline,
    country: scored.country ?? lead.country,
    // No acknowledgement email is sent here; callers that send one update it.
    emailStatus: "pending",
    kind: lead.kind,
    phone: lead.phone,
    consent,
    attribution: sanitizeAttribution(lead.attribution),
    detail: boundedDetail(lead.detail),
    createdAt: now,
    updatedAt: now,
  };

  const collection = await contactEnquiries();
  try {
    const inserted = await collection.insertOne(document);
    const id = inserted.insertedId.toHexString();

    await recordLeadActivity({
      leadKind: "enquiry",
      leadId: id,
      email: lead.email,
      type: "created",
      summary: `Lead captured from ${lead.source}.`,
      detail: {
        kind: lead.kind,
        score: scored.score,
        grade: scored.grade,
      },
    }).catch(() => undefined);

    return { id, reference, created: true };
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      const existing = await collection.findOne(
        { requestId },
        { projection: { _id: 1, reference: 1 } },
      );
      if (existing?._id) {
        return {
          id: existing._id.toHexString(),
          reference: existing.reference,
          created: false,
        };
      }
    }
    throw error;
  }
}
