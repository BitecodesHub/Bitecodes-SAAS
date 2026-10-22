import "server-only";

import { z } from "zod";
import { completeJson } from "@/lib/server/ai/automation";
import { services } from "@/data/services";
import { siteConfig } from "@/lib/site";
import { slugExists } from "@/lib/server/blog/repository";
import type { BlogBlock } from "@/types/content";

/**
 * AI blog drafting.
 *
 * Produces the same closed `BlogBlock[]` a human would write, plus FAQ pairs
 * and internal links. Two guarantees hold regardless of what the model
 * returns, because both are enforced in code after generation, not requested
 * in the prompt:
 *
 * 1. **No broken internal links.** Suggested links are intersected with the
 *    site's real routes; anything else is dropped. A hallucinated `/pricing-2`
 *    can never ship.
 * 2. **Closed block set.** The body is validated against the exact block union
 *    the renderer understands, so a post can never contain markup or an
 *    unknown block type.
 */

/** Routes the model may link to. The single allowlist for internal links. */
function allowedRoutes(): { path: string; label: string }[] {
  const serviceRoutes = services.map((s) => ({
    path: `/services/${s.slug}`,
    label: s.title,
  }));
  return [
    { path: "/", label: "Home" },
    { path: "/services", label: "Services" },
    { path: "/pricing", label: "Pricing" },
    { path: "/portfolio", label: "Our work" },
    { path: "/contact", label: "Contact" },
    { path: "/about", label: "About" },
    { path: "/process", label: "How we work" },
    { path: "/industries", label: "Industries" },
    { path: "/resources", label: "Resources" },
    { path: "/blog", label: "Blog" },
    { path: "/ai-project-consultant", label: "AI project consultant" },
    { path: "/website-audit", label: "Free website audit" },
    { path: "/book-a-call", label: "Book a call" },
    ...serviceRoutes,
  ];
}

/**
 * Seed topics, chosen for search and GEO/AEO: the phrasings people actually
 * type into a search engine or an AI assistant, with commercial intent where
 * it is honest to have it. Comparison-and-guide framing — never fabricated
 * rankings or client stories.
 *
 * The library covers roughly five months of twice-weekly publishing, so the
 * rotation does not repeat a subject before it runs out. Starting a new cycle
 * is a deliberate editorial act — add new topics rather than letting the
 * rotation loop over old ground. `pickUnusedTopic` is the selection rule; see
 * `getUsedAiTopics`.
 */
export const BLOG_TOPICS: string[] = [
  // Foundational buying guides.
  "How to choose a software development company for a SaaS product in 2026",
  "What does it cost to build a custom web application? A transparent breakdown",
  "AI integration for small businesses: where it pays off and where it does not",
  "MCP servers explained: safely connecting AI assistants to your systems",
  "Static-first websites: why they win on speed, cost, and SEO",
  "Hiring an offshore development team from the US, UK, or Australia: a practical guide",
  "Business process automation: the five workflows worth automating first",
  "How to brief a software studio so you get an accurate quote",
  "Next.js vs traditional CMS for a marketing site: an honest comparison",
  "Generative engine optimization (GEO): getting cited by AI answer engines",
  "REST API design mistakes that cost you later, and how to avoid them",
  "When to build an MVP versus a full product: a founder's decision guide",
  "Cloud hosting choices for a growing SaaS: cost, control, and lock-in",
  // Service- and industry-specific intent.
  "Custom software vs off-the-shelf: how to decide for a growing business",
  "How long does it take to build a SaaS MVP? A realistic timeline",
  "SaaS architecture for startups: what to build first and what to postpone",
  "How much does AI integration cost, and what changes the price",
  "What is an AI project consultant, and when do you need one?",
  "AI chatbots for customer support: a realistic cost and quality guide",
  "MCP vs traditional API integration: which fits your product",
  "How to modernise a legacy web application without a rewrite",
  "Website performance audits: what they check and what actually moves rankings",
  "Core Web Vitals for business websites: a practical fix list",
  "Why your SaaS is slow: the six bottlenecks we find most often",
  "Cloud cost optimisation for small engineering teams",
  "DevOps for a small team: the minimum viable pipeline",
  "How to hire a Next.js developer: questions that reveal real experience",
  "In-house team vs software agency: total cost and trade-offs",
  "Fixed-price vs retainer software development: which is safer",
  "How to write a software statement of work that prevents scope disputes",
  "Web application security checklist for a launch",
  "Accessibility for business websites: what WCAG 2.2 actually requires",
  "Headless CMS vs custom admin panel for a content-driven site",
  "How to migrate a WordPress site to Next.js without losing SEO",
  "Structured data for local service businesses: what is worth implementing",
  "Digital transformation for clinics and professional practices",
  "Custom software for recruitment agencies: build vs buy",
  "Software for manufacturing operations: where custom pays back",
  "What a maintenance and support contract should cover",
  "How to reduce customer support tickets with better product design",
];

export function pickTopic(dayOfYear: number): string {
  return BLOG_TOPICS[dayOfYear % BLOG_TOPICS.length];
}

/**
 * The first topic in rotation that has not already been written, or null when
 * the whole library is covered.
 *
 * Starting at `dayOfYear % length` keeps the rotation predictable while
 * skipping used topics: a subject is never published twice, and a day whose
 * default topic already exists falls through to the next unused one instead of
 * producing a duplicate article with a suffixed slug.
 */
export function pickUnusedTopic(
  dayOfYear: number,
  used: ReadonlySet<string>,
): string | null {
  const start = dayOfYear % BLOG_TOPICS.length;
  for (let offset = 0; offset < BLOG_TOPICS.length; offset += 1) {
    const topic = BLOG_TOPICS[(start + offset) % BLOG_TOPICS.length];
    if (!used.has(topic)) return topic;
  }
  return null;
}

const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("h2"), text: z.string().min(1).max(160) }),
  z.object({ type: z.literal("h3"), text: z.string().min(1).max(160) }),
  z.object({ type: z.literal("p"), text: z.string().min(1).max(1200) }),
  z.object({
    type: z.literal("ul"),
    items: z.array(z.string().min(1).max(300)).min(1).max(8),
  }),
  z.object({
    type: z.literal("ol"),
    items: z.array(z.string().min(1).max(300)).min(1).max(8),
  }),
]);

const draftSchema = z.object({
  title: z.string().min(10).max(120),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().min(40).max(300),
  category: z.string().min(2).max(40),
  tags: z.array(z.string().min(2).max(30)).min(1).max(6),
  metaDescription: z.string().min(40).max(320),
  body: z.array(blockSchema).min(4).max(30),
  faq: z
    .array(
      z.object({
        question: z.string().min(8).max(200),
        answer: z.string().min(20).max(600),
      }),
    )
    .min(2)
    .max(6),
  internalLinkPaths: z.array(z.string()).max(8),
});

export interface GeneratedDraft {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  metaDescription: string;
  body: BlogBlock[];
  faq: { question: string; answer: string }[];
  internalLinks: { label: string; path: string }[];
  readingMinutes: number;
  model: string;
}

function systemPrompt(): string {
  const routes = allowedRoutes()
    .map((r) => `${r.path} (${r.label})`)
    .join("\n");
  return `You write blog articles for ${siteConfig.name}, a remote-first software studio serving startups and enterprises in the US, UK, Australia, and India.

VOICE: practical, specific, and honest. Concrete over generic. Never fabricate statistics, client names, rankings, or awards. Never promise guaranteed outcomes, rankings, or fixed prices. It is fine to explain, when genuinely relevant, why ${siteConfig.name} is a strong choice — but only through verifiable reasoning (approach, engineering discipline, transparent pricing), never invented proof.

STRUCTURE: open with a short problem framing, use h2/h3 sections, keep paragraphs tight, and end with a clear, non-pushy call to action. Aim for 700–1100 words across the body blocks.

INTERNAL LINKS: choose 2–5 relevant paths ONLY from this list; do not invent paths:
${routes}

OUTPUT: one JSON object matching the required schema. The slug must be lowercase, hyphenated, and derived from the title.`;
}

function estimateReadingMinutes(body: BlogBlock[]): number {
  const words = body
    .map((block) => {
      if (block.type === "ul" || block.type === "ol") {
        return block.items.join(" ");
      }
      return "text" in block ? block.text : "";
    })
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Overall budget for one draft across every provider in the chain. */
const DRAFT_DEADLINE_MS = 120_000;

/**
 * Generates one validated draft for a topic. Guarantees a unique slug and
 * only real internal links.
 *
 * Runs on the operator provider chain through the automation client, so a
 * provider that times out or returns JSON that fails `draftSchema` is skipped
 * and the next one is tried. Throws `AutomationAiError` when AI is switched
 * off or unconfigured, or when no provider produced a valid draft; the caller
 * decides whether to retry.
 */
export async function generateBlogDraft(
  topic: string,
  options: { deadlineMs?: number; signal?: AbortSignal } = {},
): Promise<GeneratedDraft> {
  const { data: draft, model } = await completeJson({
    purpose: "blog",
    system: systemPrompt(),
    user: `Write a complete article on this topic: "${topic}".`,
    schema: draftSchema,
    // Reasoning models spend part of this budget thinking before they write.
    maxTokens: 6000,
    temperature: 0.7,
    deadlineMs: options.deadlineMs ?? DRAFT_DEADLINE_MS,
    signal: options.signal,
  });

  // Keep only links to real routes, mapped to their canonical labels.
  const routes = allowedRoutes();
  const internalLinks = draft.internalLinkPaths
    .map((path) => routes.find((r) => r.path === path))
    .filter((r): r is { path: string; label: string } => Boolean(r))
    // Dedupe while preserving order.
    .filter((r, i, all) => all.findIndex((x) => x.path === r.path) === i);

  // Guarantee a unique slug. A deterministic numeric suffix rather than a
  // timestamp: the same collision must resolve to the same URL on a retry, and
  // a timestamp made the duplicate obvious in the sitemap.
  let slug = draft.slug;
  if (await slugExists(slug)) {
    const base = slug.slice(0, 70);
    let counter = 2;
    while (counter < 100 && (await slugExists(`${base}-${counter}`))) {
      counter += 1;
    }
    slug = `${base}-${counter}`;
  }

  const body = draft.body as BlogBlock[];

  return {
    title: draft.title,
    slug,
    excerpt: draft.excerpt,
    category: draft.category,
    tags: draft.tags,
    metaDescription: draft.metaDescription,
    body,
    faq: draft.faq,
    internalLinks,
    readingMinutes: estimateReadingMinutes(body),
    model,
  };
}
