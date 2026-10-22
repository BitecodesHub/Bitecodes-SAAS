import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  contactSchema,
  CONTACT_CONSENT_TEXT,
  MARKETING_CONSENT_TEXT,
  type ContactResponse,
} from "@/lib/contact";
import { contactEnquiries } from "@/lib/server/db/collections";
import { sendContactEmails } from "@/lib/server/email";
import { captureLead } from "@/lib/server/leads/capture";
import { consumeContactRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_384;

function json(body: ContactResponse, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
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
    return json(
      { ok: false, code: "INVALID", message: "The message is too large." },
      413,
    );
  }

  const rateLimit = await consumeContactRateLimit(getClientKey(request));
  if (!rateLimit.allowed) {
    return json(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: "Too many messages were sent. Please try again later.",
      },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(
      {
        ok: false,
        code: "INVALID",
        message: "Please check the form and try again.",
      },
      400,
    );
  }

  const result = contactSchema.safeParse(payload);
  if (!result.success) {
    return json(
      {
        ok: false,
        code: "INVALID",
        message: "Please correct the highlighted fields.",
        fieldErrors: result.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const enquiry = result.data;
  if (enquiry.website) {
    return json({ ok: true, reference: "BC-RECEIVED" }, 202);
  }

  const requestId = randomUUID();

  try {
    const captured = await captureLead({
      requestId,
      kind: "form",
      source: "website-contact",
      name: enquiry.name,
      email: enquiry.email,
      company: enquiry.company || null,
      budget: enquiry.budget || null,
      message: enquiry.message,
      timeline: enquiry.timeline || null,
      country: enquiry.country || null,
      role: enquiry.role || null,
      consent: {
        contact: true,
        marketing: enquiry.followUp === true,
        text: enquiry.followUp ? MARKETING_CONSENT_TEXT : CONTACT_CONSENT_TEXT,
      },
      attribution: enquiry.attribution,
    });

    const collection = await contactEnquiries();
    try {
      await sendContactEmails(enquiry, captured.reference);
      await collection.updateOne(
        { requestId },
        {
          $set: {
            emailStatus: "sent",
            emailsSentAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
    } catch {
      await collection.updateOne(
        { requestId },
        {
          $set: {
            emailStatus: "failed",
            updatedAt: new Date(),
          },
        },
      );
    }

    // Only a genuinely new lead gets a new sequence. A retried request must
    // not produce a second enrolment.
    if (captured.created && enquiry.followUp) {
      try {
        const { enrollLead } = await import("@/lib/server/email/sequences");
        await enrollLead({
          leadKind: "enquiry",
          leadId: captured.id,
          email: enquiry.email,
          name: enquiry.name,
          consentAt: new Date(),
        });
      } catch {
        // The enquiry is safely stored; a sequence failure is recoverable from
        // the admin panel and must not turn a successful submission into a 503.
      }
    }

    return json({ ok: true, reference: captured.reference }, 201);
  } catch {
    return json(
      {
        ok: false,
        code: "UNAVAILABLE",
        message:
          "We could not safely save your message. Please try again or email us directly.",
      },
      503,
    );
  }
}
