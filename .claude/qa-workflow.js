export const meta = {
  name: "bitecodes-qa",
  description:
    "Exhaustive multi-dimensional QA of the redesigned Bitecodes site: review → adversarially verify → synthesize a prioritized fix list",
  phases: [
    { title: "Review", detail: "5 dimension reviewers read source + curl rendered HTML" },
    { title: "Verify", detail: "adversarial skeptic per finding tries to refute" },
    { title: "Synthesize", detail: "dedup + prioritize confirmed fixes" },
  ],
};

const REPO = "/Users/mac/Desktop/Projects/Bitecodes-SAAS";
const BASE = "http://localhost:3100";

const CONTEXT = `
You are reviewing the REDESIGNED Bitecodes marketing site (a software outsourcing studio).
Repo root: ${REPO}
A production Next.js server is running at ${BASE} — curl real prerendered HTML to confirm rendering (e.g. \`curl -s ${BASE}/ | head -c 2000\`).

DESIGN INTENT (do NOT report these as issues — they are deliberate):
- Light-first, white/warm-paper canvas, pure-white cards, single deep-indigo accent, generous rounded corners (radius 1.25rem).
- Typography: Inter (Google Fonts sans) for body AND display headings (headings get tighter tracking via a global h1/h2/h3 rule). Dark mode still supported via next-themes toggle but light is default.
- Minimalist: hairline borders, soft shadows, restrained two-stop accent gradient (.text-gradient), single subtle hero wash (.bg-mesh), fine grid (.bg-grid).
- Already fixed: dark-first theme flipped to light; hardcoded violet/indigo/blue rainbow gradients replaced with token-driven equivalents in button, cta-section, founder-section, desktop-nav, service-card, project-card, page-header, not-found; bg-card/30 → bg-muted/50; bg-background/60 inputs → solid; footer year dynamic; services count dynamic; tech-icon contrast darkened; back-to-top respects reduced-motion; redundant theme-toggle sr-only removed; removeConsole in prod; immutable cache on /_next/static; optimizePackageImports for lucide+motion; LazyMotion+domAnimation+m components.

YOUR JOB: find REAL, actionable problems the redesign missed or introduced — bugs, UI/visual defects, accessibility gaps, SEO/GEO weaknesses, performance regressions, broken links, placeholder content, hydration risks, contrast failures, responsive breakage, inconsistent tokens. Be specific: cite file:line and quote evidence. Prefer high-signal findings over nitpicks. Each finding needs a concrete suggested fix.`;

const FINDINGS_SCHEMA = {
  type: "object",
  properties: {
    dimension: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "stable id like vis-1" },
          title: { type: "string" },
          file: { type: "string", description: "path:line" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          description: { type: "string" },
          evidence: { type: "string" },
          suggestedFix: { type: "string" },
        },
        required: ["id", "title", "file", "severity", "description", "evidence", "suggestedFix"],
      },
    },
  },
  required: ["dimension", "findings"],
};

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    isReal: { type: "boolean", description: "true only if this is a genuine, actionable defect" },
    severity: { type: "string", enum: ["high", "medium", "low", "none"] },
    reasoning: { type: "string" },
    action: { type: "string", description: "concrete fix to apply, or 'dismiss'" },
  },
  required: ["id", "isReal", "severity", "reasoning", "action"],
};

const DIMENSIONS = [
  {
    key: "visual-theme",
    prompt: `${CONTEXT}

DIMENSION: Visual / theme / UI consistency.
Read these and scan ALL components for residual issues:
- src/app/globals.css (tokens, utilities), src/lib/og.tsx, src/app/manifest.ts
- ALL of src/components/** (sections, navigation, cards, ui, motion, blog, standalone)
- src/app/**/page.tsx and not-found.tsx
Specifically hunt for:
1. ANY remaining hardcoded dark-only colors (text-white, from-violet-600, via-indigo-600, to-blue-600, bg-black/40, white/X on surfaces that are now white) that break on the white theme.
2. Color-contrast failures on the white canvas (muted text, gradient text .text-gradient, tech-icon, badges, placeholder text).
3. Inconsistent radius / shadow / border usage vs the token system.
4. Responsive breakage (mobile stacking, overflow, fixed widths, tap targets <44px).
5. Hover/focus/active states that are invisible or jarring on white.
6. Rounded-edges consistency (user wants rounded where possible).
curl ${BASE}/, /services, /portfolio, /contact, /about to sanity-check rendered markup. Return up to 12 findings, highest-signal first.`,
  },
  {
    key: "accessibility",
    prompt: `${CONTEXT}

DIMENSION: Accessibility (WCAG 2.2 AA).
Audit across src/app/** and src/components/**:
1. Heading hierarchy (one h1 per page, no skipped levels, h1-h3 now render in Inter — fine, but check structure).
2. Form accessibility (contact-form.tsx: labels, aria-invalid, aria-describedby, fieldset/legend, error announcement, select).
3. Focus management & visible focus (focus-visible rings, skip link, keyboard nav for mobile-nav/dialog/accordion/tabs/navigation-menu).
4. Landmarks (header/main/nav/footer, page header sections).
5. ARIA correctness (aria-labels, aria-hidden on decorative SVG/icons, role=alert on errors, breadcrumb nav labels).
6. Color contrast (compute ratios for muted-foreground, primary on white, white on primary, gradient text).
7. Reduced-motion (all animations respect prefers-reduced-motion — check marquee, reveal, back-to-top, scroll-progress).
8. Link text / alt text / target size.
Return up to 12 findings, real violations only.`,
  },
  {
    key: "seo-geo",
    prompt: `${CONTEXT}

DIMENSION: SEO + GEO (generative engine optimization).
Audit src/lib/seo.ts, src/app/{layout,sitemap,robots,manifest,llms.txt/route,opengraph-image,apple-icon}.tsx, and every page's metadata.
1. Metadata completeness: title template, description length, canonical (alternates.canonical), OpenGraph, Twitter card, metadataBase.
2. JSON-LD validity & richness: Organization, WebSite, Person, Service, FAQPage, BreadcrumbList — check for missing/incorrect fields, @type, @id refs, areaServed, sameAs.
3. Sitemap completeness & correctness (all routes + slugs, priorities, lastModified).
4. robots.ts (AI bot allowlist, sitemap ref, host).
5. llms.txt richness & accuracy.
6. OG images per route (services/[slug], blog/[slug], portfolio/[slug], default) — do they render, are they referenced in metadata?
7. Semantic HTML & heading order for crawlers; internal linking; no broken links (cross-ref navigation.ts footerNav vs actual routes).
8. Geo/areaServed, locale, hreflang (none — is that a gap for a "worldwide" studio?).
9. Placeholder contact data in siteConfig (TODOs) — does it pollute structured data?
curl ${BASE}/sitemap.xml, /robots.txt, /llms.txt to confirm. Return up to 12 findings.`,
  },
  {
    key: "performance",
    prompt: `${CONTEXT}

DIMENSION: Performance & speed (Vercel-optimized).
Audit next.config.ts, src/app/layout.tsx (fonts), src/components/motion/**, globals.css, and all "use client" components.
1. Font loading: Inter (new) + Geist_Mono — preload, display:swap, subset, unused font vars, FOIT/FOUT, layout shift. Is Geist_Mono actually used anywhere (grep font-mono)? If unused, is it still fetched?
2. Client JS bundle: list every "use client" component and whether it's necessary; MotionProvider LazyMotion+domAnimation+m (good) — any stray motion.* (eager) imports? Heavy deps shipped to client?
3. Images: no next/image used (project cards use CSS gradients) — is that fine or a Core Web Vitals miss? Check public/ assets.
4. Caching headers (next.config headers): immutable on /_next/static, security headers, any missing cache for sitemap/robots/llms/manifest/og.
5. Render-blocking / LCP: hero is static (good), but check for above-the-fold client components, large inline styles, the grid/mesh CSS complexity.
6. CSS: Tailwind v4 purge correctness, any unused @keyframes, the CTA/founder/desktop-nav inline style blocks.
7. Third-party: none expected — confirm no script tags, no analytics/analytics-incompatible.
8. removeConsole, optimizePackageImports — confirm effective.
9. Any layout shift / CLS risks (theme toggle, scroll-progress, back-to-top, font swap).
Return up to 12 findings with measurable impact.`,
  },
  {
    key: "correctness-bugs",
    prompt: `${CONTEXT}

DIMENSION: Bugs & correctness.
Hunt across the whole src/ tree:
1. Contact form (contact-form.tsx): the submit handler simulates and discards data (no backend) — is this acceptable or a "lie"? Any zod/RHF misuse? The select element styling. Suspense boundary for useSearchParams.
2. Broken internal links: every href in navigation.ts, footerNav, cards, CTAs, sitemap vs actual routes/slugs in data/*.ts. Any dead links?
3. Dynamic routes: services/[slug], portfolio/[slug], blog/[slug] — generateStaticParams, generateMetadata, not-found handling, related/next-prev logic, opengraph-image generation.
4. Placeholder/TODO content flagged in data (stats, testimonials, founder) and siteConfig contact (email/phone/address TODOs) — does any leak into UI in a way that looks broken (e.g. "+91 00000 00000")?
5. Hydration risks: useSearchParams, theme-toggle (suppressHydrationWarning), Date/time formatting, Math.random, window refs in render.
6. Edge cases: empty arrays, missing optional fields, the 404, thank-you page, legal pages.
7. Type/runtime mismatches between data/*.ts shapes and component usage.
8. The marquee duplication, stat-counter animation, scroll-progress CSS timeline browser support.
Return up to 12 findings, real bugs only.`,
  },
];

phase("Review");

const results = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(d.prompt, {
      label: `review:${d.key}`,
      phase: "Review",
      schema: FINDINGS_SCHEMA,
      effort: "xhigh",
    }),
  (review, d) => {
    if (!review || !review.findings || review.findings.length === 0) {
      return { dimension: d.key, verified: [] };
    }
    return parallel(
      review.findings.map((f) => () =>
        agent(
          `${CONTEXT}\n\nADVERSARIAL VERIFICATION. A reviewer claims the following defect exists in the Bitecodes redesign. Your job is to REFUTE it. Read the cited file (and surrounding code) and curl the rendered page if relevant. Default to isReal=false unless you can confirm with concrete evidence that this is a genuine, actionable problem (not a deliberate design choice, not a non-issue, not already fixed). Be skeptical.\n\nFinding ${f.id} [${f.severity}]: ${f.title}\nFile: ${f.file}\nDescription: ${f.description}\nEvidence: ${f.evidence}\nSuggested fix: ${f.suggestedFix}\n\nRepo: ${REPO}. Server: ${BASE}. Verify, then return your verdict. If real, give a precise, minimal fix (exact file + change). If the suggested fix is wrong, propose the correct one.`,
          {
            label: `verify:${f.id}`,
            phase: "Verify",
            schema: VERDICT_SCHEMA,
            effort: "xhigh",
          },
        ).then((v) => ({ ...f, dimension: d.key, verdict: v })),
      ),
    ).then((verified) => ({ dimension: d.key, verified: verified.filter(Boolean) }));
  },
);

const allVerified = results
  .filter(Boolean)
  .flatMap((r) => r.verified || [])
  .filter((x) => x.verdict && x.verdict.isReal && x.verdict.severity !== "none");

phase("Synthesize");

const confirmed = allVerified.map((x) => ({
  dimension: x.dimension,
  id: x.id,
  severity: x.verdict.severity,
  title: x.title,
  file: x.file,
  problem: x.description,
  fix: x.verdict.action || x.suggestedFix,
  why: x.verdict.reasoning,
}));

const synthesis = await agent(
  `${CONTEXT}\n\nHere is a list of CONFIRMED defects in the Bitecodes redesign (each already adversarially verified):\n\n${JSON.stringify(confirmed, null, 2)}\n\nProduce a clean, deduplicated, prioritized fix list grouped by severity (high → medium → low). For each item: the exact file(s) to change and the precise edit. Merge duplicates. Order so a developer can apply them top-to-bottom. Also call out any THEMATIC gaps the verification surfaced (e.g. a class of issue not covered). Be concise and concrete.`,
  { label: "synthesize", phase: "Synthesize", effort: "xhigh" },
);

return {
  confirmedCount: confirmed.length,
  confirmed,
  synthesis,
};
