import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { sanitizeAttribution } from "@/lib/attribution";
import {
  RESOURCE_FOLLOW_UP_CONSENT_TEXT,
  RESOURCE_NEWSLETTER_CONSENT_TEXT,
  resourceRequestSchema,
} from "@/lib/resources";
import { leadMagnetRequests } from "@/lib/server/db/collections";
import type { LeadConsent } from "@/lib/server/db/types";
import { captureLead } from "@/lib/server/leads/capture";
import { notifyNewLead } from "@/lib/server/email/notify";
import { subscribeToNewsletter } from "@/lib/server/newsletter/subscribe";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { getResource } from "@/data/resources";

/**
 * The gate in front of a printable checklist.
 *
 * The guide itself is static and unlimited. This endpoint exchanges an email
 * address for the checklist, records the request and a lead, and subscribes the
 * person only when the newsletter box was ticked. It returns the checklist in
 * the response, so there is no dependency on email delivery and no reason to
 * hide the content behind a broken inbox.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_000;
const HOUR_MS = 60 * 60 * 1000;

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function hashedKey(request: NextRequest, prefix: string) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${prefix}:${candidate}`).digest("hex");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, message: "The request is too large." }, 413);
  }

  const perVisitor = await consumeRateLimit({
    bucket: "resource-request",
    key: hashedKey(request, "resource"),
    max: 10,
    windowMs: HOUR_MS,
  });
  if (!perVisitor.allowed) {
    return json(
      { ok: false, message: "Too many requests. Please try again later." },
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(
      { ok: false, message: "Enter a valid email address and try again." },
      400,
    );
  }

  const parsed = resourceRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      { ok: false, message: "Enter a valid email address and try again." },
      400,
    );
  }

  const input = parsed.data;
  const resource = getResource(input.slug);
  if (!resource?.checklist) {
    return json(
      { ok: false, message: "That checklist is not available." },
      404,
    );
  }

  // A second, address-scoped limit stops one address being used to flood the
  // request collection from many networks. The address is hashed for the key.
  const perAddress = await consumeRateLimit({
    bucket: "resource-request-email",
    key: createHash("sha256").update(input.email).digest("hex"),
    max: 5,
    windowMs: HOUR_MS,
  });
  if (!perAddress.allowed) {
    return json(
      { ok: false, message: "Too many requests. Please try again later." },
      429,
    );
  }

  const now = new Date();
  const attribution = sanitizeAttribution(input.attribution);
  const consent: LeadConsent = {
    contact: input.followUp,
    marketing: input.newsletter,
    text:
      [
        input.followUp ? RESOURCE_FOLLOW_UP_CONSENT_TEXT : null,
        input.newsletter ? RESOURCE_NEWSLETTER_CONSENT_TEXT : null,
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 500) || null,
    at: now,
  };

  try {
    const lead = await captureLead(
      {
        kind: "magnet",
        source: `resources/${resource.slug}`,
        email: input.email,
        name: input.name,
        message: `Requested “${resource.checklist.title}”.`,
        consent: {
          contact: input.followUp,
          marketing: input.newsletter,
          text: consent.text,
        },
        attribution,
        detail: {
          resourceSlug: resource.slug,
          checklist: resource.checklist.title,
          followUp: input.followUp,
          newsletter: input.newsletter,
        },
        requestId: input.requestId,
      },
      now,
    );

    const requests = await leadMagnetRequests();
    const existing = await requests.findOne({ leadId: lead.id });
    if (!existing) {
      await requests.insertOne({
        resourceSlug: resource.slug,
        email: input.email,
        name: input.name,
        consent,
        attribution,
        leadId: lead.id,
        deliveredAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // The owner should hear about this while the visitor is still on the site.
    // A retry of the same request (`created: false`) must not ring twice.
    if (lead.created) {
      await notifyNewLead({
        leadId: lead.id,
        reference: lead.reference,
        source: `resources/${resource.slug}`,
        kindLabel: "checklist request",
        name: input.name,
        email: input.email,
        message: `Requested “${resource.checklist.title}”.`,
      }).catch(() => undefined);

      // Newsletter opt-in is marketing consent, which is what the inbound
      // follow-up sequence requires. The contact-only follow-up box does not
      // authorise email marketing and must not be treated as if it did.
      if (input.newsletter) {
        try {
          const { enrollLead } = await import("@/lib/server/email/sequences");
          await enrollLead({
            leadKind: "enquiry",
            leadId: lead.id,
            email: input.email,
            name: input.name,
            consentAt: now,
          });
        } catch {
          // The lead and the checklist are safe; a sequence failure is
          // recoverable and must not turn a successful request into a 502.
        }
      }
    }

    let newsletterStatus: string = "not-requested";
    if (input.newsletter) {
      // The newsletter is owned by another package and may still report
      // `unavailable` while its double opt-in flow is being built. A failure
      // here must not withhold the checklist the visitor asked for.
      try {
        const subscription = await subscribeToNewsletter({
          email: input.email,
          source: `resources/${resource.slug}`,
          consent: true,
          consentText: RESOURCE_NEWSLETTER_CONSENT_TEXT,
        });
        newsletterStatus = subscription.status;
      } catch (error) {
        newsletterStatus = "unavailable";
        console.error(
          "[resources] Newsletter sign-up failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    return json(
      {
        ok: true,
        checklist: {
          title: resource.checklist.title,
          items: resource.checklist.items,
        },
        resource: { title: resource.title, slug: resource.slug },
        newsletter: newsletterStatus,
        reference: lead.reference,
      },
      200,
    );
  } catch (error) {
    console.error(
      "[resources] Could not record the checklist request:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    return json(
      {
        ok: false,
        message:
          "The checklist could not be prepared right now. Please try again.",
      },
      502,
    );
  }
}
