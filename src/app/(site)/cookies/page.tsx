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
      updated="October 20, 2026"
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
            "We do not use cookies for analytics, advertising, or cross-site tracking.",
          ],
        },
        {
          heading: "Website analytics without cookies",
          body: [
            "We measure the public site with our own first-party, cookieless analytics. It sets no cookies, writes no unique identifier to your device, and contacts no third party.",
            "Each visit records the page path, the referring site's host, campaign parameters from links you followed, the type of interaction (such as a page view, a tracked click, or a form event), and a one-way visitor hash. The hash is derived from your IP address and browser user agent with a salt that changes every day, so it cannot be reversed and cannot be linked across days.",
            "First-touch campaign details are kept in your browser's local storage, not in a cookie, so a later visit can be attributed to the same source. That record contains campaign values, the referring host, the landing path, and when they were first seen — no unique identifier. Clearing your browser's site data removes it.",
            "We do not store your raw IP address, browser user agent, full referring URL, or query strings. Only the five campaign values from a link are kept. Raw analytics events are deleted automatically after 180 days.",
            "When your browser sends Do Not Track or Global Privacy Control, no analytics data is collected.",
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
