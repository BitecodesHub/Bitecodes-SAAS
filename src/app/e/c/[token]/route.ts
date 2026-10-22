import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  emailMessages,
  emailSequences,
  sequenceEnrollments,
} from "@/lib/server/db/collections";
import { isSafeEmailUrl } from "@/lib/email/template";
import { getSiteUrl } from "@/lib/server/env";
import { recordLeadActivity } from "@/lib/server/leads/repository";
import { stopEnrollment } from "@/lib/server/email/sequences";
import { verifySignedToken } from "@/lib/server/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function home() {
  return NextResponse.redirect(new URL("/", getSiteUrl()), 302);
}

/**
 * Signed click redirect.
 *
 * The destination is inside the HMAC token, never a query parameter. An
 * unsigned `?u=` would turn the sending domain into an open redirect that
 * anyone could borrow for phishing, and the domain would wear the reputation
 * damage. Only http(s) destinations we signed are honoured.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const verified = verifySignedToken<{ m: string; u: string }>(
    token,
    "email-click",
  );
  if (
    !verified.ok ||
    typeof verified.data.m !== "string" ||
    typeof verified.data.u !== "string"
  ) {
    return home();
  }

  let destination: URL;
  try {
    destination = new URL(verified.data.u);
  } catch {
    return home();
  }
  if (
    !isSafeEmailUrl(destination.toString()) ||
    (destination.protocol !== "http:" && destination.protocol !== "https:")
  ) {
    return home();
  }

  const collection = await emailMessages();
  const message = await collection.findOneAndUpdate(
    { trackingId: verified.data.m },
    {
      $push: { clicks: { url: destination.toString(), at: new Date() } },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" },
  );

  if (!message) return home();

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
          type: "email-clicked",
          summary: "Clicked a link in a follow-up email.",
          detail: {
            messageId: message.messageId,
            url: destination.toString(),
          },
        });
      }

      // A click is the best available proxy for "a person should take over".
      // The sequence engine also checks this at the next step, but stopping it
      // now makes that immediate and visible in the panel.
      if (enrollment?.status === "active") {
        const sequences = await emailSequences();
        const sequence = await sequences.findOne({
          key: enrollment.sequenceKey,
        });
        if (sequence?.stopOnClick) {
          await stopEnrollment(enrollment.enrollmentId, "clicked");
        }
      }
    } catch {
      // Never block the redirect on analytics.
    }
  }

  const response = NextResponse.redirect(destination, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
