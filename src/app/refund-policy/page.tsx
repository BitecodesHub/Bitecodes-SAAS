import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { createMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Refund & Cancellation Policy",
  description:
    "How cancellations, deposits, completed work, and approved refunds are handled for Bitecodes engagements.",
  path: "/refund-policy",
});

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      slug="refund-policy"
      updated="July 20, 2026"
      intro="Software services are commissioned work. The applicable proposal or service agreement always controls; this page explains our general approach."
      sections={[
        {
          heading: "Before work begins",
          body: [
            "A project may be cancelled before scheduled work begins. Any refund of an advance depends on reserved capacity, discovery already completed, third-party commitments, and the written agreement.",
          ],
        },
        {
          heading: "Work already performed",
          body: [
            "Fees for completed discovery, design, engineering, project management, purchased licences, infrastructure, and other incurred costs are generally non-refundable.",
            "If an engagement ends early, we provide completed and paid-for deliverables in accordance with the governing agreement.",
          ],
        },
        {
          heading: "Milestones and retainers",
          body: [
            "Milestone payments become due when the associated acceptance criteria are met. Retainers reserve ongoing capacity and are governed by their notice and cancellation terms.",
          ],
        },
        {
          heading: "Approved refunds",
          body: [
            "Where a refund is approved in writing, it is returned through an agreed method after applicable work, commitments, taxes, and processing costs are reconciled. Timing can vary by payment provider.",
          ],
        },
        {
          heading: "Contact",
          body: [
            `Questions about a specific engagement should be sent to ${siteConfig.contact.email} with the proposal or invoice reference.`,
          ],
        },
      ]}
    />
  );
}
