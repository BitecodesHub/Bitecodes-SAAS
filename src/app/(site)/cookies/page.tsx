import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { createMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = createMetadata({
  title: "Cookie Policy",
  description: `How ${siteConfig.name} uses cookies and similar technologies.`,
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      slug="cookies"
      updated="June 27, 2026"
      intro="This policy explains how we use cookies and similar technologies on our website."
      sections={[
        {
          heading: "What are cookies?",
          body: [
            "Cookies are small text files placed on your device when you visit a website. They help the site function and can provide information to the site's owners.",
          ],
        },
        {
          heading: "How we use cookies",
          body: [
            "Our website is built to work with minimal cookies. We use only what is necessary for essential functionality — such as remembering your light or dark theme preference.",
            "We do not use cookies for advertising or cross-site tracking.",
          ],
        },
        {
          heading: "Managing cookies",
          body: [
            "You can control and delete cookies through your browser settings. Disabling essential cookies may affect how some parts of the site work, such as theme persistence.",
          ],
        },
        {
          heading: "Contact",
          body: [
            `If you have questions about our use of cookies, contact us at ${siteConfig.contact.email}.`,
          ],
        },
      ]}
    />
  );
}
