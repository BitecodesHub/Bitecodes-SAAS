import "server-only";

import { z } from "zod";
import { createStructuredCompletion } from "@/lib/server/ai-provider";
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
    { path: "/ai-project-consultant", label: "AI project consultant" },
    { path: "/website-audit", label: "Free website audit" },
    ...serviceRoutes,
  ];
}

/**
 * Seed topics, chosen for GEO/AEO: the phrasings people actually type into an
 * AI assistant. Honest, comparison-and-guide framing — never fabricated
 * rankings. One is picked per run by rotating on the day of the year (passed
 * in, since `Date.now()` is unavailable in some execution contexts).
 */
export const BLOG_TOPICS: string[] = [
  "How to choose a software development company for a SaaS product in 2026",
  "What does it cost to build a custom web application? A transparent breakdown",
  "AI integration for small businesses: where it pays off and where it does not",
  "MCP servers explained: safely connecting AI assistants to your systems",
  "Static-first websites: why they win on speed, cost, and SEO",
  "Hiring an offshore development team from the US, UK, or Australia: a practical guide",
  "Business process automation: the five workflows worth automating first",
  "How to brief a software studio so you get an accurate quote",
  "Next.js vs traditional CMS for a marketing site: an honest comparison",
  "What to look for in a web application development partner",
  "Generative engine optimization (GEO): getting cited by AI answer engines",
  "REST API design mistakes that cost you later, and how to avoid them",
  "When to build an MVP versus a full product: a founder's decision guide",
  "Cloud hosting choices for a growing SaaS: cost, control, and lock-in",
];

export function pickTopic(dayOfYear: number): string {
  return BLOG_TOPICS[dayOfYear % BLOG_TOPICS.length];
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

/** JSON Schema mirror for the provider's structured-output constraint. */
const draftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "slug",
    "excerpt",
    "category",
    "tags",
    "metaDescription",
    "body",
    "faq",
    "internalLinkPaths",
  ],
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    excerpt: { type: "string" },
    category: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    metaDescription: { type: "string" },
    body: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type"],
        properties: {
          type: { type: "string", enum: ["h2", "h3", "p", "ul", "ol"] },
          text: { type: "string" },
          items: { type: "array", items: { type: "string" } },
        },
      },
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
      },
    },
    internalLinkPaths: { type: "array", items: { type: "string" } },
  },
} as const;

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

OUTPUT: strictly the required JSON schema. The slug must be lowercase, hyphenated, and derived from the title.`;
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

/**
 * Generates one validated draft for a topic. Guarantees a unique slug and
 * only real internal links. Throws on a missing provider or an
 * unparsable/invalid response — the caller decides whether to retry.
 */
export async function generateBlogDraft(
  topic: string,
): Promise<GeneratedDraft> {
  const { json, model } = await createStructuredCompletion({
    system: systemPrompt(),
    user: `Write a complete article on this topic: "${topic}".`,
    schema: draftJsonSchema,
    schemaName: "bitecodes_blog_post",
    maxTokens: 4000,
    temperature: 0.7,
  });

  const parsed = draftSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("INVALID_DRAFT");
  }
  const draft = parsed.data;

  // Keep only links to real routes, mapped to their canonical labels.
  const routes = allowedRoutes();
  const internalLinks = draft.internalLinkPaths
    .map((path) => routes.find((r) => r.path === path))
    .filter((r): r is { path: string; label: string } => Boolean(r))
    // Dedupe while preserving order.
    .filter((r, i, all) => all.findIndex((x) => x.path === r.path) === i);

  // Guarantee a unique slug even if the model reuses an existing one.
  let slug = draft.slug;
  if (await slugExists(slug)) {
    slug = `${slug}-${Math.floor(Date.now() / 1000)
      .toString(36)
      .slice(-4)}`;
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
