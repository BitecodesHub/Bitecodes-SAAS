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
      updated="June 27, 2026"
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
