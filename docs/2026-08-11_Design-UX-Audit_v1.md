# Design & UX Audit — Bitecodes marketing site

Date: 2026-08-11 · Scope: public site `(site)`, auth, dashboard shell · Direction: Apple-inspired ("less, but better")

## Executive summary

The site's underlying token system ("Quiet Confidence", OKLCH, single indigo accent) is sound, but the rendered result reads as AI-generated because a handful of centrally defined utilities inject the same visual clichés on every page: gradient headline text, gradient hairline card rings, indigo glow shadows, mesh/grid hero backdrops, pill badges, and a floating pill navbar. The homepage stacks 14 near-identical sections (~13,000 px). The fix is concentrated: restyle the shared utilities and primitives once, then tighten each page.

## AI-generated tells (ranked by visibility)

1. **Gradient hero/headline text** — `.text-gradient` (13 files). Apple: solid near-black ink.
2. **Gradient CTA buttons with indigo glow hover** — `variant="gradient"` (33 files), `--shadow-glow`.
3. **Pill badge eyebrows on every section** — `SectionHeader` renders a `Badge` pill (16 files).
4. **Gradient hairline rings on cards** — `.gradient-ring` (6 files).
5. **Mesh + graph-grid hero backdrop** — `.bg-mesh` (13), `.bg-grid` (10).
6. **Floating pill navbar** with glass border and sparkle-pill announcement link in hero.
7. **Identical section rhythm ×14**: pill badge → centered H2 → subtitle → 4-column icon-chip card grid.
8. **Tech-pill marquee**, icon-in-tinted-circle cards, scroll-progress gradient bar.

## UX findings

- **Homepage length**: 14 sections; most visitors never reach the bottom half. Target ≤8 with clearer narrative.
- **Scroll-reveal overuse**: 47 elements start at `opacity: 0`; 0.6 s reveals with −10% viewport margin leave visible empty bands mid-scroll. Reduce to 0.35 s, 12 px offset, earlier trigger.
- **Dual identity tension**: header says "Get started free" (SaaS) while hero says "Start a project" (agency). Both audiences land on the same page with equal-weight CTAs. Needs a deliberate hierarchy decision (flagged, not unilaterally changed).
- **Chat FAB sits bottom-left**, overlapping content; convention is bottom-right.
- **Nav overload**: mega-menu exposes 19 services at once.

## Performance notes (initial)

- Good: `next/font`, `LazyMotion`, `optimizePackageImports`, no blocking third parties observed yet.
- Suspects: 13,000 px DOM, infinite marquee animation, backdrop-filter surfaces, reveal animation cost, `cacheComponents`/`unstable_instant` not adopted (this Next.js version validates instant navigation; see `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`).
- Production build measurement scheduled (port 3100) before/after.

## Direction (adapted, not copied, from apple.com)

Typography does the branding: large, semibold, tightly tracked near-black headings; gray body text; pure-white canvas alternating with light-gray bands; one indigo accent reserved for actions; flat solid buttons; hairline dividers instead of decorated borders; fast subtle motion. Bitecodes sells services/SaaS, not hardware photography — so restraint and typographic hierarchy are the transferable principles.

## Remediation plan

1. Redefine shared utilities/primitives centrally (this converts every page at once).
2. Rebuild hero + homepage; cut/merge sections.
3. Per-page sweep (pricing, products, about, contact, blog, tools, auth, dashboard).
4. Performance pass with production build measurements.
5. `pnpm verify` + full-site browse (desktop, mobile, dark) as the exit gate.

## Status — completed 2026-08-11

All five stages executed the same day. Verified outcomes:

- **AI tells removed sitewide**: zero gradient text/rings/glows/mesh/grid/Sparkles across 32 audited routes (two independent agent sweeps + workflow re-audit). Only intentional photo-legibility scrims remain. Legacy `gradient`/`glass` button variants stay as aliases in `ui/button.tsx`; do not use in new code.
- **Homepage**: 14 sections → 9; height ~13,000 px → 7,001 px (−46%).
- **Reveals are pure CSS** (`.reveal-in`, scroll-driven animation): served HTML contains zero `opacity:0` content; works without JavaScript; respects reduced motion. `motion` and `leaflet` removed from dependencies; the public site ships no animation library.
- **Performance**: all marketing routes prerender static/SSG (125 pages, build 3.5 s); homepage JS 234 KB gzipped; local TTFB ~9 ms. `cacheComponents`/`unstable_instant` deliberately NOT adopted: routes are already static, so the migration would add risk to the dashboard/admin for negligible public-site gain.
- **Verification**: `pnpm verify` green (lint, types, format, 829 tests, build). Headless checks: 15 key pages have zero horizontal overflow at 375 px and correct dark-mode token flips. Pixel-level eyeballing of every page was not possible in this environment (hidden browser pane produces no frames); hero verified visually on the production build.

Open business decision (flagged, not changed): the header sells the SaaS ("Get started free") while the hero sells the studio ("Start a project") — which audience leads is a positioning call for the owner.
