import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { createMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Privacy Policy",
  description: `How ${siteConfig.name} collects, uses, and protects your information.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      slug="privacy"
      updated="October 8, 2026"
      intro={`${siteConfig.name} ("we", "us") respects your privacy. This policy explains what information we collect when you use our website and how we handle it.`}
      sections={[
        {
          heading: "Information we collect",
          body: [
            "When you contact us through our website, we collect the information you choose to provide — such as your name, email address, company, and message.",
            "We also collect limited, anonymous technical information (such as aggregated page views) to understand how the site is used and to improve it.",
          ],
        },
        {
          heading: "How we use information",
          body: [
            "We use the information you provide solely to respond to your enquiry, deliver the services you request, and communicate with you about your project.",
            "We do not sell your personal information, and we do not share it with third parties except as necessary to operate our business or comply with the law.",
          ],
        },
        {
          heading: "Notes desktop app",
          body: [
            "If you sign in to the Notes desktop app with your account, we store the prompts you send and the answers you receive, together with the time, the request type, the app version and operating system, token counts, and a one-way hash of your IP address. Screenshots you send are used only to produce the answer and are not stored.",
            "To answer your requests, the text and screenshots you send are processed by third-party AI providers that we choose (such as NVIDIA, OpenRouter, Groq or Amazon Web Services). We ask providers not to retain or train on this data where they offer that option.",
            "Desktop prompts, answers and sign-in activity are kept for 180 days and then deleted automatically. Access within our team is limited to account owners. You can disconnect any desktop device at any time from the Connect desktop app page.",
          ],
        },
        {
          heading: "Data retention",
          body: [
            "We retain contact information only for as long as needed to fulfil the purpose for which it was collected, after which it is securely deleted.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "You may request access to, correction of, or deletion of the personal information we hold about you at any time by contacting us.",
            `To exercise any of these rights, email us at ${siteConfig.contact.email}.`,
          ],
        },
        {
          heading: "Security",
          body: [
            "We take reasonable technical and organizational measures to protect your information against unauthorized access, loss, or misuse.",
          ],
        },
        {
          heading: "Contact",
          body: [
            `If you have any questions about this policy, please contact us at ${siteConfig.contact.email}.`,
          ],
        },
      ]}
    />
  );
}
