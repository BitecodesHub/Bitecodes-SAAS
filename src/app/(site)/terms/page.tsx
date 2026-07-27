import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { createMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Terms & Conditions",
  description: `The terms that govern your use of the ${siteConfig.name} website.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      slug="terms"
      updated="June 27, 2026"
      intro={`These terms govern your use of the ${siteConfig.name} website. By using the site, you agree to them.`}
      sections={[
        {
          heading: "Use of the site",
          body: [
            "You may use this website for lawful purposes only. You agree not to misuse the site, attempt to disrupt it, or access it in any way other than through the interface we provide.",
          ],
        },
        {
          heading: "Intellectual property",
          body: [
            `All content on this site — including text, design, graphics, and code — is the property of ${siteConfig.name} unless otherwise stated, and is protected by applicable intellectual-property laws.`,
            "You may not reproduce, distribute, or create derivative works from this content without our written permission.",
          ],
        },
        {
          heading: "Services",
          body: [
            "Descriptions of our services on this site are for general information. The specific scope, deliverables, and terms of any engagement are governed by a separate written agreement.",
          ],
        },
        {
          heading: "Disclaimer",
          body: [
            'The site is provided on an "as is" basis. While we strive for accuracy, we make no warranties about the completeness or reliability of the content.',
          ],
        },
        {
          heading: "Limitation of liability",
          body: [
            "To the fullest extent permitted by law, we are not liable for any indirect or consequential loss arising from your use of this website.",
          ],
        },
        {
          heading: "Contact",
          body: [
            `Questions about these terms can be sent to ${siteConfig.contact.email}.`,
          ],
        },
      ]}
    />
  );
}
