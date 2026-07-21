import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { contactSchema, type ContactResponse } from "@/lib/contact";
import { sendContactEmails } from "@/lib/server/email";
import { getDatabase } from "@/lib/server/mongodb";
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

  const rateLimit = consumeContactRateLimit(getClientKey(request));
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
  const reference = `BC-${requestId.slice(0, 8).toUpperCase()}`;

  try {
    const database = await getDatabase();
    await database.collection("contact_enquiries").insertOne({
      requestId,
      reference,
      name: enquiry.name,
      email: enquiry.email,
      company: enquiry.company || null,
      budget: enquiry.budget || null,
      message: enquiry.message,
      role: enquiry.role || null,
      source: "website-contact",
      status: "new",
      emailStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      await sendContactEmails(enquiry, reference);
      await database.collection("contact_enquiries").updateOne(
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
      await database.collection("contact_enquiries").updateOne(
        { requestId },
        {
          $set: {
            emailStatus: "failed",
            updatedAt: new Date(),
          },
        },
      );
    }

    return json({ ok: true, reference }, 201);
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
