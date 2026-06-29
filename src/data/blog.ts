import type { BlogPost } from "@/types/content";

export const blogPosts: BlogPost[] = [
  {
    slug: "static-first-nextjs",
    title: "Why we build static-first with Next.js",
    excerpt:
      "Static-first rendering is the single highest-leverage decision for a fast website. Here is how we think about it — and when we reach for dynamic instead.",
    category: "Engineering",
    tags: ["Next.js", "Performance", "Architecture"],
    author: "Ismail",
    date: "2026-05-28",
    readingMinutes: 6,
    featured: true,
    body: [
      {
        type: "p",
        text: "Most websites are dynamic by habit, not by need. A marketing page that changes a few times a month does not need to be rendered on every request. Yet that is exactly what a default server setup does — recomputing the same HTML thousands of times.",
      },
      { type: "h2", text: "Render once, serve everywhere" },
      {
        type: "p",
        text: "With Next.js we render pages at build time and serve them from the edge as static HTML. The browser gets meaningful content in the first round trip, the server does almost no work, and the experience holds up on slow networks and low-end devices.",
      },
      { type: "h2", text: "What we keep static" },
      {
        type: "ul",
        items: [
          "Marketing, services, portfolio, and content pages",
          "Anything driven by data that changes infrequently",
          "SEO-critical routes that must respond instantly",
        ],
      },
      { type: "h2", text: "When we go dynamic" },
      {
        type: "p",
        text: "Personalized dashboards, real-time data, and authenticated flows are rendered on demand — but only those parts. The rest of the page stays static. This split is where modern frameworks shine, and it is how we keep even data-heavy products fast.",
      },
    ],
  },
  {
    slug: "safe-mcp-servers",
    title: "Designing MCP servers that are actually safe",
    excerpt:
      "Model Context Protocol servers let AI assistants act on your systems. That power needs boundaries. Here is the design checklist we use.",
    category: "AI",
    tags: ["MCP Servers", "AI", "Security"],
    author: "Ismail",
    date: "2026-05-12",
    readingMinutes: 7,
    featured: true,
    body: [
      {
        type: "p",
        text: "An MCP server is a bridge between an AI assistant and your real systems. Done well, it is transformative. Done carelessly, it is a confused deputy with your credentials. The difference is design discipline.",
      },
      { type: "h2", text: "Typed, narrow tools" },
      {
        type: "p",
        text: "Every tool should do one thing with a precise, validated schema. Narrow tools are easier to reason about, easier to audit, and far harder to misuse than a single do-anything endpoint.",
      },
      { type: "h2", text: "Scope and audit everything" },
      {
        type: "ul",
        items: [
          "Grant the least privilege each tool needs — no more",
          "Log every invocation with inputs and outcomes",
          "Put irreversible actions behind explicit confirmation",
        ],
      },
      { type: "h2", text: "Fail loudly, never silently" },
      {
        type: "p",
        text: "When something is ambiguous, the right answer is to ask, not to guess. We design servers that refuse rather than improvise, because a refused action is recoverable and a wrong one often is not.",
      },
    ],
  },
  {
    slug: "ai-integration-that-ships",
    title: "A practical guide to AI integration that ships",
    excerpt:
      "AI features fail when they are bolted on as demos. They succeed when they solve a specific user problem with guardrails. Here is our approach.",
    category: "AI",
    tags: ["AI Integration", "Product", "LLM"],
    author: "Ismail",
    date: "2026-04-30",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "The temptation with AI is to add a chat box and call it innovation. The products that actually stick do something narrower: they remove a specific, repetitive piece of friction the user feels every day.",
      },
      { type: "h2", text: "Start from the job, not the model" },
      {
        type: "p",
        text: "We begin by naming the exact task — summarizing a document, drafting a reply, extracting structured data — and only then choose the model and retrieval strategy that fit. The model is an implementation detail.",
      },
      { type: "h2", text: "Measure before you trust" },
      {
        type: "p",
        text: "Every AI feature ships with an evaluation set and guardrails. We track quality, latency, and cost, and we treat regressions like any other bug. Trust is earned with numbers.",
      },
    ],
  },
  {
    slug: "near-perfect-lighthouse",
    title: "How we hit near-perfect Lighthouse scores",
    excerpt:
      "A perfect performance score is not luck. It is a set of deliberate choices made early and defended throughout the build.",
    category: "Performance",
    tags: ["Performance", "Core Web Vitals", "Next.js"],
    author: "Ismail",
    date: "2026-04-15",
    readingMinutes: 6,
    featured: true,
    body: [
      {
        type: "p",
        text: "Performance is not something you optimize at the end. By then the expensive decisions are already made. We treat a performance budget as a constraint we design within from day one.",
      },
      { type: "h2", text: "Ship less JavaScript" },
      {
        type: "p",
        text: "The fastest code is the code you never send. We default to server components, lazy-load interactivity, and keep animation off the critical path. The result is pages that are interactive almost the moment they appear.",
      },
      { type: "h2", text: "The checklist" },
      {
        type: "ul",
        items: [
          "Static rendering and aggressive caching",
          "Optimized images in modern formats with blur placeholders",
          "Self-hosted, subset fonts to avoid layout shift",
          "Reduced-motion-aware animation, loaded only when needed",
        ],
      },
    ],
  },
  {
    slug: "spring-boot-architecture",
    title: "Spring Boot architecture for systems that last",
    excerpt:
      "Enterprise software is judged in years, not weeks. Here is how we structure Spring Boot services to age gracefully.",
    category: "Engineering",
    tags: ["Spring Boot", "Java", "Architecture"],
    author: "Ismail",
    date: "2026-03-22",
    readingMinutes: 7,
    body: [
      {
        type: "p",
        text: "The hard part of enterprise software is not the first release — it is the fiftieth change request two years later. Architecture is what determines whether that change takes an hour or a week.",
      },
      { type: "h2", text: "Boundaries first" },
      {
        type: "p",
        text: "We organize around clear domain boundaries, keep business logic out of controllers, and treat the database as an implementation detail behind well-defined interfaces. This keeps the system easy to test and easy to evolve.",
      },
      { type: "h2", text: "Observability is not optional" },
      {
        type: "p",
        text: "Structured logging, metrics, and tracing go in from the start. When something breaks at 2am, the difference between minutes and hours of downtime is whether you can see what is happening.",
      },
    ],
  },
  {
    slug: "mvp-to-scale",
    title: "From MVP to scale without a rewrite",
    excerpt:
      "Move fast early without painting yourself into a corner. The trick is knowing which decisions are cheap to change and which are not.",
    category: "Product",
    tags: ["Startups", "Architecture", "Product"],
    author: "Ismail",
    date: "2026-03-05",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "Startups are told to move fast, and they should. But speed and a future rewrite are not the same trade. The goal is to defer the expensive decisions while still shipping today.",
      },
      { type: "h2", text: "Cheap to change vs. expensive to change" },
      {
        type: "p",
        text: "UI, copy, and most features are cheap to change later — so we move fast there. Data models, authentication, and core boundaries are expensive — so we give them more thought up front, even in an MVP.",
      },
      { type: "h2", text: "Foundations that scale" },
      {
        type: "p",
        text: "A clean data model and a sensible architecture cost little extra on day one and save a rewrite on day five hundred. That is the foundation we build every MVP on.",
      },
    ],
  },
];

export const blogCategories = Array.from(
  new Set(blogPosts.map((p) => p.category)),
);

export function getPost(slug: string) {
  return blogPosts.find((p) => p.slug === slug);
}

export function relatedPosts(slug: string, limit = 3) {
  const current = getPost(slug);
  if (!current) return [];
  return blogPosts
    .filter((p) => p.slug !== slug)
    .map((p) => ({
      post: p,
      score:
        (p.category === current.category ? 2 : 0) +
        p.tags.filter((t) => current.tags.includes(t)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.post);
}
