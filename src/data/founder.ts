import { services } from "@/data/services";
import { siteConfig } from "@/lib/site";

/*
 * OWNER MUST REVIEW: every claim below is limited to facts held in this
 * repository. Confirm the role wording, location, focus areas, and mission
 * statement before publication, and add nothing that cannot be evidenced.
 */

const MISSION =
  "I started Bitecodes to build software that is fast, reliable, and easy to maintain. My aim is simple: do careful work, explain it plainly, and remain accountable after launch.";

const focusSlugs = [
  "web-applications",
  "ai-integration",
  "mcp-servers",
  "cloud-solutions",
  "technical-consulting",
];

export const founder = {
  name: siteConfig.founder,
  founded: siteConfig.founded,
  title: "Founder",
  location: siteConfig.contact.address.full,
  mission: MISSION,
  /** Used by structured data and the AI-crawler summaries. */
  short: MISSION,
  /** Service titles the founder works on, kept in step with src/data/services.ts. */
  expertise: services
    .filter((service) => focusSlugs.includes(service.slug))
    .map((service) => service.title),
  /*
   * Compatibility fields for src/app/llms-full.txt, which is owned by another
   * package. They contain no additional biography: the same mission statement,
   * no principles, and the same statement as the quote.
   */
  bio: [MISSION],
  principles: [] as { title: string; description: string }[],
  quote: MISSION,
} as const;
