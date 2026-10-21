import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  emailMessages,
  sequenceEnrollments,
} from "@/lib/server/db/collections";
import { recordLeadActivity } from "@/lib/server/leads/repository";
import { getSiteUrl } from "@/lib/server/env";
import { verifySignedToken } from "@/lib/server/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A 1×1 transparent GIF. No user data, no response body worth caching. */
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64",
);

function home() {
  return NextResponse.redirect(new URL("/", getSiteUrl()), 302);
}

/**
 * Open-tracking pixel.
 *
 * Opens are approximate by nature: image proxies and privacy clients prefetch
 * or block the pixel. It is still useful as a directional signal, and the UI
 * says "opened" rather than "read". A missing or tampered token redirects home
 * instead of returning a pixel, so this endpoint cannot be used to write
 * arbitrary rows.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const verified = verifySignedToken<{ m: string }>(token, "email-open");
  if (!verified.ok || typeof verified.data.m !== "string") return home();

  const trackingId = verified.data.m;
  const collection = await emailMessages();
  const message = await collection.findOneAndUpdate(
    { trackingId },
    { $push: { opens: new Date() }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!message) return home();

  // Attach the open to the lead timeline when this was a lead sequence. A
  // missing enrolment is not an error: the message may predate the CRM.
  if (message.enrollmentId) {
    try {
      const enrollments = await sequenceEnrollments();
      const enrollment = await enrollments.findOne({
        enrollmentId: message.enrollmentId,
      });
      if (enrollment?.leadId && enrollment.leadKind) {
        await recordLeadActivity({
          leadKind: enrollment.leadKind as "enquiry" | "consultant" | "audit",
          leadId: enrollment.leadId,
          email: message.to,
          type: "email-opened",
          summary: "Opened a follow-up email.",
          detail: { messageId: message.messageId },
        });
      }
    } catch {
      // Tracking must never fail the pixel.
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}
