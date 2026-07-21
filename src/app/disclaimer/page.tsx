import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { createMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Website & Tool Disclaimer",
  description:
    "Important limitations for Bitecodes website content, estimates, AI recommendations, audits, portfolio information, and external links.",
  path: "/disclaimer",
});

export default function DisclaimerPage() {
  return (
    <LegalPage
      title="Website & Tool Disclaimer"
      slug="disclaimer"
      updated="July 20, 2026"
      intro="The Bitecodes website provides general information and early planning tools. It does not replace discovery, professional advice, a signed proposal, or a security assessment."
      sections={[
        {
          heading: "Pricing and cost calculators",
          body: [
            "Published prices and calculator results are indicative planning ranges based on stated assumptions. They are not binding offers. Final scope, timing, taxes, dependencies, exclusions, and commercial terms require a written proposal.",
          ],
        },
        {
          heading: "AI-generated recommendations",
          body: [
            "AI consultant output can be incomplete or incorrect. Bitecodes reviews requirements, risks, architecture, estimates, and recommendations before issuing a proposal. Do not submit secrets, regulated data, credentials, or confidential client information to public AI tools.",
          ],
        },
        {
          heading: "Website audits",
          body: [
            "The public website audit checks one public HTML response and selected headers. It is not a penetration test, full crawler, browser performance test, accessibility certification, legal compliance review, or guarantee that a website is secure.",
          ],
        },
        {
          heading: "Portfolio and results",
          body: [
            "Case studies describe project context and selected outcomes. Any indicative, representative, or client-provided information should not be interpreted as a guarantee that another project will achieve the same result.",
          ],
        },
        {
          heading: "External services",
          body: [
            "Links to client or third-party websites are provided for convenience. Their content, availability, cookies, security, and privacy practices are controlled by their respective operators.",
          ],
        },
        {
          heading: "Contact",
          body: [
            `For clarification before relying on website information, contact ${siteConfig.contact.email}.`,
          ],
        },
      ]}
    />
  );
}
