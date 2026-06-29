import { siteConfig } from "@/lib/site";
import { services } from "@/data/services";
import { projects } from "@/data/projects";
import { technologies } from "@/data/technologies";
import { founder } from "@/data/founder";
import { industries } from "@/data/industries";
import { faqs } from "@/data/faqs";
import { getPricing, formatStartingPrice } from "@/lib/pricing";

// Concise AI-crawler summary following the llms.txt convention
// (https://llmstxt.org). Generated from local data so it never drifts.
// Expanded, citation-ready detail lives at /llms-full.txt.
export const dynamic = "force-static";

export function GET() {
  const { url, name, tagline, description, contact, social, founded } =
    siteConfig;

  const lines: string[] = [];
  lines.push(`# ${name}`);
  lines.push("");
  lines.push(`> ${tagline} ${description}`);
  lines.push("");
  lines.push(
    `${name} is a remote-first software outsourcing studio founded in ${founded} by ${founder.name}. It designs, builds, ships, and maintains websites, web and enterprise applications, SaaS platforms, REST APIs, mobile apps, cloud infrastructure, and applied AI — including AI integration, agentic workflows, and Model Context Protocol (MCP) servers — for startups and enterprises worldwide.`,
  );
  lines.push("");
  lines.push(`Expanded, citation-ready detail: ${url}/llms-full.txt`);
  lines.push("");

  lines.push("## What Bitecodes does");
  for (const s of services) {
    const price = getPricing(s.slug);
    const priceStr = price ? ` — ${formatStartingPrice(price)}` : "";
    lines.push(
      `- [${s.title}](${url}/services/${s.slug}): ${s.tagline}${priceStr}`,
    );
  }
  lines.push("");

  lines.push("## Pricing");
  lines.push(
    "Per-service starting-from pricing, viewable in USD, INR, and AUD. Final quotes are scoped after a short discovery conversation; Bitecodes works on fixed-scope or dedicated-capacity bases.",
  );
  for (const s of services) {
    const price = getPricing(s.slug);
    if (!price) continue;
    lines.push(
      `- [${s.title}](${url}/services/${s.slug}): ${formatStartingPrice(price)}`,
    );
  }
  lines.push(
    `A consolidated pricing page is at ${url}/pricing. Full per-service detail (features, stack, offers) is in ${url}/llms-full.txt.`,
  );
  lines.push("");

  lines.push("## Case studies");
  for (const p of projects) {
    lines.push(
      `- [${p.name}](${url}/portfolio/${p.slug}) (${p.client}, ${p.year}): ${p.teaser}`,
    );
  }
  lines.push("");

  lines.push("## Industries served");
  lines.push(industries.map((i) => i.name).join(", ") + ".");
  lines.push("");

  lines.push("## Technologies");
  lines.push(technologies.map((t) => t.name).join(", ") + ".");
  lines.push("");

  lines.push("## Founder");
  lines.push(`${founder.name} — ${founder.title}. ${founder.short}`);
  lines.push(`Expertise: ${founder.expertise.join(", ")}.`);
  lines.push("");

  lines.push("## FAQ");
  for (const f of faqs) {
    lines.push(`- ${f.question}`);
  }
  lines.push(
    `Structured FAQ data (FAQPage JSON-LD) is embedded on the site, e.g. ${url}/#faq and per-service pages. Full Q&A in ${url}/llms-full.txt.`,
  );
  lines.push("");

  lines.push("## Key pages");
  lines.push(`- [Home](${url}/)`);
  lines.push(`- [Services](${url}/services)`);
  lines.push(`- [Pricing](${url}/pricing)`);
  lines.push(`- [Portfolio](${url}/portfolio)`);
  lines.push(`- [About](${url}/about)`);
  lines.push(`- [Process](${url}/process)`);
  lines.push(`- [Technologies](${url}/technologies)`);
  lines.push(`- [Industries](${url}/industries)`);
  lines.push(
    `- [Blog](${url}/blog) — RSS: ${url}/rss.xml, Atom: ${url}/atom.xml`,
  );
  lines.push(`- [Careers](${url}/careers)`);
  lines.push(`- [Contact](${url}/contact)`);
  lines.push("");

  lines.push("## Contact");
  lines.push(`- Email: ${contact.email}`);
  lines.push(`- Sales: ${contact.salesEmail}`);
  lines.push(`- Phone: ${contact.phone}`);
  lines.push(`- Location: ${contact.address.full}`);
  lines.push(`- GitHub: ${social.github}`);
  lines.push(`- LinkedIn: ${social.linkedin}`);
  lines.push(`- X: ${social.x}`);
  lines.push(`- Instagram: ${social.instagram}`);
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
