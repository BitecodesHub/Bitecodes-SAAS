import { siteConfig } from "@/lib/site";
import { services, serviceCategories } from "@/data/services";
import { projects } from "@/data/projects";
import { technologies, techCategories } from "@/data/technologies";
import { founder } from "@/data/founder";
import { industries } from "@/data/industries";
import { blogPosts } from "@/data/blog";
import { faqs } from "@/data/faqs";
import { processSteps } from "@/data/process";
import { getPricing, formatStartingPrice } from "@/lib/pricing";

// Expanded, citation-ready LLM document (https://llmstxt.org).
// Information-dense companion to /llms.txt. Generated from local data
// so it never drifts from the live site.
export const dynamic = "force-static";

export function GET() {
  const { url, name, tagline, description, contact, social, founded } =
    siteConfig;

  // Resolve tech slugs -> human names once.
  const techName = new Map(technologies.map((t) => [t.slug, t.name]));
  const stackNames = (slugs: string[]) =>
    slugs.map((s) => techName.get(s) ?? s).join(", ");

  const L: string[] = [];
  const push = (s = "") => L.push(s);

  push(`# ${name}`);
  push("");
  push(`> ${tagline}`);
  push("");
  push(`${name} — ${description}`);
  push("");

  // --- Overview ---
  push("## Overview");
  push(
    `${name} is a remote-first software outsourcing studio founded in ${founded} by ${founder.name}, based in Ahmedabad, Gujarat, India, working with clients worldwide. It designs, builds, ships, and maintains websites, web and enterprise applications, SaaS platforms, REST APIs, mobile apps, cloud infrastructure, and applied AI — including AI integration, agentic workflows, and Model Context Protocol (MCP) servers — for startups and enterprises.`,
  );
  push(
    `Service categories: ${serviceCategories.join(", ")}. Industries served: ${industries.map((i) => i.name).join(", ")}.`,
  );
  push(
    `This document is the canonical, machine-readable summary of ${name}'s offerings, work, and process.`,
  );
  push("");

  // --- Services ---
  push("## Services");
  push(
    `${services.length} services across ${serviceCategories.length} categories. Each lists category, tagline, full description, features, representative stack, and starting-from pricing in USD, INR, and AUD.`,
  );
  push("");
  for (const s of services) {
    push(`### ${s.title}`);
    push(`URL: ${url}/services/${s.slug}`);
    push(`Category: ${s.category}`);
    push(`Tagline: ${s.tagline}`);
    push(`Description: ${s.description}`);
    push(`Features: ${s.features.join("; ")}.`);
    push(`Stack: ${stackNames(s.stack)}.`);
    const price = getPricing(s.slug);
    push(
      price
        ? `Starting from: ${formatStartingPrice(price)} (${price.model}).`
        : "Starting from: contact for pricing.",
    );
    push("");
  }

  // --- Industries ---
  push("## Industries");
  push(`${industries.length} industries served.`);
  push("");
  for (const i of industries) {
    push(`### ${i.name}`);
    push(`URL: ${url}/industries`);
    push(`Description: ${i.description}`);
    push(`Highlights: ${i.highlights.join(", ")}.`);
    push("");
  }

  // --- Technologies ---
  push("## Technologies");
  push(
    `${technologies.length} technologies across ${techCategories.length} categories: ${techCategories.join(", ")}.`,
  );
  push("");
  for (const t of technologies) {
    push(`### ${t.name}`);
    push(`URL: ${url}/technologies`);
    push(`Category: ${t.category}`);
    push(`Description: ${t.description}`);
    push("");
  }

  // --- Case studies ---
  push("## Case studies");
  push(`${projects.length} portfolio projects.`);
  push("");
  for (const p of projects) {
    push(`### ${p.name}`);
    push(`URL: ${url}/portfolio/${p.slug}`);
    push(`Client: ${p.client}`);
    push(`Category: ${p.category}`);
    push(`Year: ${p.year}`);
    push(`Teaser: ${p.teaser}`);
    push(`Overview: ${p.overview}`);
    push(`Challenge: ${p.challenge}`);
    push(`Solution: ${p.solution}`);
    push(`Features: ${p.features.join("; ")}.`);
    push(
      `Results: ${p.results.map((r) => `${r.metric} ${r.label}`).join("; ")}.`,
    );
    push(`Stack: ${stackNames(p.technologies)}.`);
    push("");
  }

  // --- Writing / Blog ---
  push("## Writing");
  push(
    `${blogPosts.length} articles. Feed: ${url}/rss.xml (RSS 2.0), ${url}/atom.xml (Atom 1.0).`,
  );
  push("");
  for (const b of blogPosts) {
    push(`### ${b.title}`);
    push(`URL: ${url}/blog/${b.slug}`);
    push(`Date: ${b.date}`);
    push(`Category: ${b.category}`);
    push(`Tags: ${b.tags.join(", ")}`);
    push(`Author: ${b.author}`);
    push(`Excerpt: ${b.excerpt}`);
    push("");
  }

  // --- Founder ---
  push("## Founder");
  push(`${founder.name} — ${founder.title}.`);
  push(`Location: ${founder.location}`);
  push("");
  for (const para of founder.bio) push(para);
  push("");
  push(`Expertise: ${founder.expertise.join(", ")}.`);
  push("");
  push("Principles:");
  for (const pr of founder.principles) {
    push(`- ${pr.title}: ${pr.description}`);
  }
  push("");
  push(`Quote: "${founder.quote}"`);
  push("");

  // --- Process ---
  push("## Process");
  push(`${processSteps.length}-stage delivery process.`);
  push("");
  for (const step of processSteps) {
    push(`${step.step}. ${step.title}`);
    push(`Description: ${step.description}`);
    push(`Deliverables: ${step.deliverables.join(", ")}.`);
    push("");
  }

  // --- FAQ ---
  push("## FAQ");
  push(`${faqs.length} frequently asked questions.`);
  push("");
  for (const f of faqs) {
    push(`Q: ${f.question}`);
    push(`A: ${f.answer}`);
    push("");
  }

  // --- Key links ---
  push("## Key links");
  push(`- Home: ${url}/`);
  push(`- Services: ${url}/services`);
  push(`- Pricing: ${url}/pricing`);
  push(`- Portfolio: ${url}/portfolio`);
  push(`- Industries: ${url}/industries`);
  push(`- Technologies: ${url}/technologies`);
  push(`- Process: ${url}/process`);
  push(`- About: ${url}/about`);
  push(`- Blog: ${url}/blog`);
  push(`- Careers: ${url}/careers`);
  push(`- Contact: ${url}/contact`);
  push(`- Concise LLM summary: ${url}/llms.txt`);
  push(`- Sitemap index: ${url}/sitemap-index.xml`);
  push(`- Robots: ${url}/robots.txt`);
  push(`- Manifest: ${url}/manifest.webmanifest`);
  push("");

  // --- Contact ---
  push("## Contact");
  push(`- General email: ${contact.email}`);
  push(`- Sales email: ${contact.salesEmail}`);
  push(`- Phone: ${contact.phone}`);
  push(`- Address: ${contact.address.full}`);
  push(`- GitHub: ${social.github}`);
  push(`- LinkedIn: ${social.linkedin}`);
  push(`- X (Twitter): ${social.x} (@${siteConfig.twitterHandle})`);
  push(`- Instagram: ${social.instagram}`);
  push("");

  push(
    `Structured data: ${name} embeds Schema.org JSON-LD sitewide — Organization, Service (with multi-currency Offer in USD/INR/AUD), OfferCatalog (on /pricing), FAQPage, Person, BreadcrumbList, and WebSite — to support search engines and AI answer engines.`,
  );
  push("");

  return new Response(L.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control":
        "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    },
  });
}
