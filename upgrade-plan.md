# Bitecodes Production Upgrade Plan

**Prepared:** 2026-10-22  
**Repository:** `Bitecodes-SAAS`  
**Current branch:** `main`  
**Plan status:** Repository implementation complete and deployed to production; owner-gated release items and deferred findings remain
**Scope:** Consolidate the unfinished Claude/OpenCode work, the Customer-Magnet growth engine, and the AI Chatbot product into one production-grade upgrade sequence.

> This is an implementation plan, not a claim that all work below is already complete. Existing code is reused where it is verified; unfinished work is explicitly listed with acceptance criteria and rollout gates.

## Current execution ledger

### Completed in this worktree

- Baseline and repository-side growth/reporting cleanup were reviewed.
- The existing Customer-Magnet implementation covers discovery, enrichment, audits, scoring, CRM, lead capture, analytics, content, sitemap/navigation, lifecycle, referrals, proposals, and growth-job orchestration.
- The public-site implementation already includes the resource and industry surfaces, metadata/sitemap/robots/LLM surfaces, structured marketing routes, analytics beacon, conversion capture, and scheduled search/content jobs from the growth-engine release.
- Weekly reporting now reads live analytics, lead, prospect, content, and sent-email data and queues the owner report through the existing email system.
- Chatbot appearance now supports a persisted, validated launcher emoji with legacy-safe defaults.
- The generated widget now applies the secondary-color gradient, configured emoji, suggested-question buttons, and `bubble`, `fullscreen`, and `embedded` display modes.
- Autonomous bootstrap (`src/lib/server/bootstrap.ts`, `src/instrumentation.ts`) creates the settings document, four discovery presets, templates, sequence, and chatbot models on an empty database; it preserves edited values, coalesces concurrent runs, reconciles at most daily, repairs an entirely empty preset list on heartbeat, and never enables auto-contact.
- The capability matrix (`src/lib/server/capabilities.ts`) is the single source of truth for enabled/manual/disabled/degraded states and for the closed/manual/open outbound gate. No secret value is exposed.
- Health and bootstrap are observable without a setup wizard: `GET /api/health` (shallow, 503 only on database failure), `GET /api/health?deep=1` (bearer `CRON_SECRET`, live probes), and `POST /api/health/bootstrap` (dry-run or live), plus the `/admin/growth` bootstrap panel and admin health checks.
- Discovery runs regardless of the auto-contact switch; `settings.automation.autopilot` gates enrolment only. Every send still passes approval, consent, suppression, caps, and the outbound gate.
- Operations documentation is complete: `docs/operations/ENVIRONMENT_SECURITY_PRIVACY.md` (profiles, variables, secret classes, privacy/retention), `docs/operations/RUNBOOKS.md` (all seven required incidents), a real `README.md`, and a corrected/extended `docs/growth/OWNER_CHECKLIST.md`.
- Referrals are now a verified-account program rather than a cosmetic code: signup records attribution atomically, only a verified email qualifies a redemption, the reward is journalled exactly once through the wallet ledger, and a daily reconciliation job pays anything a crash left owed. The unauthenticated `/api/referrals/signup` endpoint was removed; the dashboard shows the account's own persisted code and redemptions.
- Every inbound acquisition path now reaches the owner with zero configuration: resource checklists, website-audit report requests, and AI consultant briefs emit `newLead` notifications (deduplicated by lead creation), while form and booking recipients are honoured even when the central channel switch is off. Newsletter opt-ins on resource pages also enrol the inbound follow-up sequence, and only with explicit marketing consent.
- The marketing site now has a grounded, rate-limited assistant (`/api/site-assistant`) built only from service, package, FAQ, and site data, with human fallback CTAs when no provider is configured. The previous non-functional assistant endpoint was removed.
- Conversion events now cover the remaining lead forms: `lead_magnet`, `audit_request`, `consultant_used`, and `lead_contact`, with token-bearing report paths excluded from analytics.
- Analytics and SEO corrections: the analytics client can send token-free conversion paths, `llms.txt` is in the sitemap, the default `SITE_URL` example is the served `www` host rather than the apex that answers 308, and the widget derives its API origin at runtime.
- Cron reliability has two independent drivers: the GitHub Actions heartbeat for five-minute ticks and a daily Vercel Cron entry in `vercel.json` as a floor. Vercel authenticates the request with the hosting `CRON_SECRET` automatically, so the fallback needs no extra setup. The runbooks now treat both as the global stop.

### Owner-gated release items

- Supply and verify owner-controlled credentials, DNS, SPF/DKIM/DMARC, consent/legal approvals, payment webhooks, and an authenticated cron deployment. These cannot be safely fabricated by repository code.
- Sign the environment/security/privacy matrix and complete the runbook restore drill; both have blank owner sign-off fields by design.
- Perform browser route/widget smoke tests and the required security review against a deployed canary.
- The callback calling agent remains unimplemented (toggle only); keep it off. See deferred findings below.

### Latest verification evidence

- `TEST_MONGODB_URI=mongodb://127.0.0.1:27017 pnpm test`: **131 test files passed, 1,573 tests passed, 6 skipped** (the live OSM/email suites, skipped by design). Includes the bootstrap, autopilot, health, capabilities, auth, billing, outreach, widget, SEO, reporting, referral, conversion, and job-priority suites.
- Focused autonomous slice: `src/lib/server/capabilities.test.ts` (7 passed), `src/lib/server/bootstrap.test.ts` (4 passed), `src/lib/server/autopilot.test.ts` (8 passed), `src/app/api/health/route.test.ts` (6 passed).
- Focused referral slice: `src/lib/server/referrals.test.ts` (5 passed, against MongoDB) — one code per account, no reward before verification, malformed/unknown/self codes rejected, reward paid once, reconciliation pays qualified-unpaid rows without double-paying.
- Server-level empty-database drill (`next start` on a fresh local database with only MongoDB, `AUTH_SECRET`, `CRON_SECRET`, and `SITE_URL` configured; optional providers blanked):
  - `/api/health` returned 200 with bootstrap version 1, four presets, schedule healthy, outbound gate `closed`, queue empty; capabilities reported 6 enabled, 2 manual, 2 degraded, 5 disabled, with no secret values.
  - `/`, `/sitemap.xml`, `/robots.txt`, and `/llms.txt` returned 200 with no optional providers.
  - Deep health returned 200 (`warn`, not `fail`) with remedies; unauthenticated deep health and `/api/cron/run` returned 401.
  - A restart preserved the settings document, four presets, 14 templates, two sequences, and three models, and kept the original `lastReconciledAt`; a live reconcile inserted nothing.
  - Scratch databases were dropped after the drill.
- Empty-database bootstrap test evidence: dry run writes nothing; first real run creates settings, four presets, and seeds; a second forced run is idempotent and preserves an edited postal address and paused preset; a heartbeat inside the 24-hour window restores the defaults only after the preset list is emptied.
- Safety evidence: capability and bootstrap tests assert the outbound gate is `closed` without SMTP/sender/postal, `manual` with approval on, `open` only when fully configured and approval off; autopilot tests assert discovery still runs with auto-contact off and enrols nobody.
- `pnpm lint`: passed. `pnpm typecheck`: passed. `pnpm format:check`: passed. `pnpm build`: passed (Next.js 16.2.9, 151 static pages generated, including the site assistant route and referral job).
- GitHub Actions `CI` on `main` (`65099a2`): passed. The first run failed only because the runner kernel 6.19 cannot start `mongo:8` (SERVER-121912); the workflow now pins `mongo:7.0.41`, which is exempt and matches the 7.x driver.
- Production deployment verified on `https://www.bitecodes.com` (Vercel deployment of the merged main branch):
  - `GET /api/health` returned 200 with `database.ok: true`, bootstrap version 1, four enabled discovery presets, `scheduleOk: true`, and 12 enabled / 1 manual / 2 disabled capabilities. `GET /api/health?deep=1` without a bearer token returned 401.
  - `GET /`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/llms-full.txt`, `/website-audit`, `/resources`, `/ai-project-consultant`, and `/signup?ref=…` returned 200. `/book-a-call` returned 307 to `/contact?intent=call`. `robots.txt` names GPTBot, ClaudeBot, and PerplexityBot; `sitemap.xml` includes `llms.txt`.
  - `POST /api/site-assistant` returned 200 with a grounded answer quoting the published Launch package price and the booking CTA.
  - `/widget.js` served version `2.0.0` with the widget version header and the runtime-derived API origin.
  - A dispatched production heartbeat returned `ok: true`, ran 25 jobs with 0 failures, and recorded `heartbeat.lastTickOk: true`; the remaining queued work drains across subsequent ticks. GitHub's cron schedule change may take until the next scheduled window to replace the previous cadence.
- Production live suite (2026-10-22, 90/90 checks): 26 public routes, auth/admin redirects, sitemap index plus 92 URLs, robots AI-crawler rules, `llms.txt`/`llms-full.txt`, RSS, canonical/OG/JSON-LD, widget version/origin/parse checks, assistant grounding, deep-health and cron authorization, one controlled checklist lead with an idempotent retry, and static-asset caching. `/api/assistant` and the removed referral endpoint returned 404.
- Live queue investigation found and fixed two reliability defects that unit tests could not see:
  - Strict oldest-first claiming let a discovery fan-out starve the next autopilot tick; the runner now claims `autopilot.tick` and `prospect.discover` first and allows 100 jobs per authenticated tick. A focused test asserts a priority job wins over an older backlog.
  - Three Overpass mirrors at 90s could consume the entire 300s function and leave a discovery `running` behind its lock. Each attempt is now capped at 70s, discovery requires 220s of remaining budget, and the run budget is 240s. The reclaimed job completed, `running` returned to 0, and the tick recorded success at 208s.
  - Post-fix ticks returned 200 with `ok: true`, ran 100 jobs, left no running jobs, and drained the queue; subsequent growth is fresh enrichment work from the week's discovery fan-out, which drains on later ticks.
- Embedded-widget CORS: the fail-closed path is verified live (invalid `id`/`t` returns 204 with no `Access-Control-Allow-Origin`). The positive path cannot be exercised on production without a real customer chatbot id and public token; the demo page intentionally shows placeholders. The allowlist matcher and widget preflight contract are covered by 43 passing tests (`domains.test.ts`, `widget-origin.test.ts`).
- No `.env.local` reads, secret prints, force-pushes, or history rewrites were performed while producing this evidence.

### Deferred findings

1. **No strict Content-Security-Policy.** `next.config.ts` sets `nosniff`, HSTS, referrer policy, permissions policy, and frame guards, but not a CSP. Risk: injected-script containment is weaker than it should be. Recommended: introduce a report-only CSP, collect violations, then enforce. Owner: engineering/security review.
2. **Callback calling agent has no telephony integration.** `src/lib/growth/toggles.ts` exposes `callingAgent` and the admin UI renders it, but no code reads ElevenLabs/Twilio credentials and no call can be placed. Risk: an owner may believe enabling the switch activates calls. Mitigation recorded in `docs/growth/OWNER_CHECKLIST.md` O8 (keep off) and the environment matrix (known limitation). Do not enable until a provider, consent capture, and DND compliance procedure exist.
3. **Chat transcripts have no automatic retention.** `chat_conversations` has no TTL; the privacy matrix explicitly states this and warns against promising a retention period. Risk: personal data accumulates indefinitely. Recommended: define a retention window, add a TTL or scheduled deletion, and update the privacy copy.
4. **`CHAT_SUMMARIES_ENABLED` is unused.** It appears in `.env.example` but no code reads it; chat summaries are controlled by the `chatSummaries` growth toggle. Risk: an operator believes the variable changes behavior. Remove it or mark it as documentation-only.
5. **Preset restoration is intentionally all-or-nothing.** Defaults are installed only when the entire preset list is empty; deleting one preset permanently removes it until the list is emptied or a forced bootstrap runs. Risk: an operator who deletes one default may expect it back. This behavior is documented in the autopilot panel and covered by the bootstrap test; changing it would risk resurrecting deliberately deleted searches.

## How to use this document

This section is intentionally operational so an engineer or small coding model can execute the plan without inventing scope.

1. Work on one task ID at a time. Do not start a task until every dependency in its `Depends on` column is `DONE`.
2. Before editing, read the listed target files and their tests. Search for existing helpers before adding a new one.
3. Keep changes surgical. Do not reformat unrelated files, rename public routes, rotate secrets in code, or rewrite history.
4. After each task:
   - run the task's validation command;
   - inspect the diff;
   - record the result in the task ledger;
   - commit a coherent slice when the task is independently revertible.
5. If a task exposes an unrelated bug, record it under `Deferred findings` with evidence. Fix it only when it blocks the current acceptance criteria.
6. Stop and report a **BLOCKED** status, rather than guessing, when a task needs credentials, a business decision, production data, a migration approval, or a destructive operation.
7. Never mark a task complete from a typecheck alone. Every task needs behavior-level evidence.

### Task status vocabulary

- `TODO`: not started.
- `IN_PROGRESS`: actively being implemented.
- `BLOCKED`: cannot proceed; record the exact blocker and owner.
- `DONE`: acceptance criteria and validation evidence are recorded.
- `DEFERRED`: intentionally outside the release; record why and the risk.

### Required task record

For every task, record:

```text
ID:
Status:
Owner:
Depends on:
Files/symbols changed:
Migration/config impact:
Validation command(s):
Evidence:
Rollback:
Notes/blockers:
```

Use the repository issue/PR or the release notes for these records; do not create a second plan file.

## 1. Context and current state

### 1.1 Sources reviewed

- The current repository, branch state, recent commits, working-tree changes, scripts, environment contract, and deployment configuration.
- `docs/growth/2026-10-18_Customer-Magnet-Growth-Plan_v1.md`.
- `docs/ai-chatbot-saas-architecture.md`.
- The local Claude session for the broader “admin access and client acquisition system” request.
- Existing chatbot admin UI, chatbot server actions/repository, data model, API routes, embed widget, tests, and current production verification conventions.
- The current session’s completed growth-engine validation output.

### 1.2 Current repository facts

- The current branch is `growth/customer-magnet`.
- The `feat/ai-employee-brand-pricing-blog` branch contains a separate earlier Claude implementation stream. It must be compared and selectively ported or merged; it must not be blindly merged because both branches touch shared navigation, settings, SEO, jobs, and marketing pages.
- The current worktree has intentional uncommitted growth-engine changes. These must be committed separately before integrating another branch.
- Existing scripts are:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm format:check`
  - `pnpm test`
  - `pnpm build`
  - `pnpm verify` (all five gates in sequence)
- The latest completed gate passed lint, typecheck, formatting, tests, and production build.
- Local tests currently skip MongoDB integration suites unless `TEST_MONGODB_URI` is configured. A production release must run those suites against an isolated disposable test database.
- Existing product infrastructure includes MongoDB repositories, server actions, authentication, admin capabilities, email queueing, background jobs, rate limiting, analytics, billing foundations, and multiple admin dashboards.

### 1.3 Existing AI Chatbot facts

The chatbot already has:

- Customer dashboard and admin chatbot pages.
- Tenant-scoped chatbot documents and repository methods.
- Chatbot appearance storage and update validation.
- Public-token and API-key authentication.
- Knowledge sources, chunking, retrieval, and model catalogue foundations.
- Chatbot API routes and a generated `widget.js` embed.
- Appearance editor with a live preview.
- Tests for repository, retrieval, chunking, extraction, models, and API keys.

The appearance model currently includes:

- `theme`
- `avatar`
- `logo`
- `primaryColor`
- `secondaryColor`
- `position`
- `size`
- `displayMode`
- `welcomeMessage`
- `placeholder`
- `typingAnimation`
- `branding`
- `language`
- `timezone`
- `suggestedQuestions`
- `starterPrompts`

The widget currently applies only part of this contract. The editor explicitly identifies these gaps:

- `secondaryColor` is stored but not rendered.
- Only `bubble` display mode is implemented; `popup`, `fullscreen`, and `embedded` are not.
- `language`, `timezone`, `suggestedQuestions`, and `starterPrompts` are not exposed in the editor or consumed by the widget.
- Emoji/bubble-icon customization is not implemented as a first-class setting.

## 2. Outcomes required before production release

The upgrade is complete only when all of the following are true:

1. The public marketing site has a consistent, accessible, mobile-safe brand and UX.
2. All pricing, product claims, contact details, and international positioning are consistent across pages, metadata, feeds, `llms.txt`, and structured data.
3. The client-acquisition engine can discover, qualify, audit, stage, and safely contact prospects with explicit compliance gates and owner visibility.
4. The AI Chatbot is a coherent self-serve product with correct token accounting, safe retrieval, reliable streaming, configurable appearance, and a stable embed.
5. Admin and customer workflows have clear failure states, auditability, authorization, and recovery paths.
6. Background jobs are idempotent, observable, retry-safe, deadline-aware, and protected by feature toggles.
7. SEO, analytics, lead capture, conversion, retention, and reporting are measurable rather than placeholder implementations.
8. Every release passes unit tests, integration tests, typecheck, lint, formatting, production build, route smoke tests, and security review.
9. Owner-only infrastructure actions are documented and verified without placing credentials in source control.
10. Rollout is staged with a rollback path for the widget, billing, outbound email, and automation independently.

11. **Autonomous-by-default operation is the target.** After deployment, the system must self-initialize safe defaults, discover work, execute enabled jobs, measure outcomes, and recover from transient failures without an operator clicking a first-run setup wizard. It must not pretend that missing credentials, DNS changes, payment accounts, legal approvals, or consent can be invented by code.
12. **Search visibility is maximized, not guaranteed.** No system can guarantee a first-place result in Google, Bing, or an AI answer engine. The implementation must maximize eligible visibility through technical SEO, useful original content, trusted citations, structured data, crawlability, performance, and measured iteration, while never using spam, fabricated reviews, doorway pages, keyword stuffing, or false claims.

## 2.1 Executable task register

Implement these IDs in order. The detailed checklists below provide the subtasks and acceptance criteria for each group.

| ID | Task | Depends on | Required evidence |
|---|---|---|---|
| `U0.1` | Freeze baseline and record current state | none | baseline report, clean diff review |
| `U0.2` | Commit current growth changes | `U0.1` | commit hash, `git diff --check` |
| `U0.3` | Reconcile earlier Claude branch | `U0.2` | file-level decision matrix, integration diff |
| `U0.4` | Create release branch and CI checklist | `U0.3` | branch name, checklist link |
| `U1.1` | Verify auth/session/recovery flows | `U0.4` | focused auth tests and browser evidence |
| `U1.2` | Prove tenant isolation and capability checks | `U1.1` | negative authorization tests |
| `U1.3` | Verify secrets, cookies, CSRF, rate limits, and audit logs | `U1.2` | security test results |
| `U2.1` | Reconcile brand assets and marketing UI | `U0.4` | route/visual sweep |
| `U2.2` | Complete responsive/accessibility states | `U2.1` | keyboard/mobile/accessibility checklist |
| `U2.3` | Add visual/browser regression coverage | `U2.2` | screenshots and console report |
| `U3.1` | Establish canonical pricing/config source | `U0.3` | duplicate-value audit |
| `U3.2` | Verify billing/order/webhook idempotency | `U3.1`, `U1.2` | fixture payment tests |
| `U3.3` | Configure payment and manual-reconciliation runbook | `U3.2` | provider test transaction |
| `U4.1` | Verify prospect discovery/enrichment/scoring | `U0.4` | fixture provider run |
| `U4.2` | Verify CRM lifecycle and pipeline | `U4.1`, `U1.2` | lifecycle transition tests |
| `U4.3` | Verify automation idempotency, caps, and approval gate | `U4.2` | repeated-job test and no-send proof |
| `U4.4` | Verify funnel analytics and outreach compliance | `U4.3` | event reconciliation and suppression tests |
| `U4.5` | Enable autonomous safe bootstrap and bounded acquisition loop | `U4.4`, `U9.1` | empty-DB repeated-run evidence, zero-send closed-gate proof |
| `U5.1` | Reconcile blog/content data sources | `U0.3` | published/draft fixture matrix |
| `U5.2` | Complete route metadata/schema/indexability audit | `U5.1` | crawler/metadata report |
| `U5.3` | Verify conversion events and search surfaces | `U5.2` | event fixture and sitemap/robots evidence |
| `U5.4` | Enable autonomous SEO/content health loop | `U5.3`, `U9.1` | quality-gate, idempotency, and stop-condition evidence |
| `U6.1` | Verify chatbot CRUD, public config, and API auth | `U1.2` | contract and negative tests |
| `U6.2` | Prove token ledger atomicity and failure semantics | `U6.1` | concurrency and rollback tests |
| `U6.3` | Harden retrieval, streaming, provider failures, and abuse controls | `U6.2` | adversarial/timeout tests |
| `U7.1` | Specify and validate appearance contract | `U6.1` | schema/default/compatibility tests |
| `U7.2` | Implement safe emoji/icon customization | `U7.1` | XSS/allowlist tests |
| `U7.3` | Implement colors, sizes, positions, modes, prompts, and branding | `U7.2` | widget contract tests |
| `U7.4` | Align editor preview with generated widget | `U7.3` | screenshot/config parity |
| `U7.5` | Version/roll out widget safely | `U7.4` | old-embed and canary evidence |
| `U8.1` | Reconcile analytics and source-of-truth metrics | `U4.4`, `U5.3` | fixture reconciliation |
| `U8.2` | Verify digest/report/lifecycle/retention jobs | `U8.1` | job handler tests and queued email evidence |
| `U8.3` | Add operational alerts and failure dashboards | `U8.2` | simulated failure alert |
| `U9.1` | Complete environment/security/privacy matrix | `U1.3`, `U3.3`, `U4.4`, `U6.3` | signed-off matrix |
| `U9.2` | Run full integration/security/release validation | all code tasks | CI and security reports |
| `U9.3` | Canary, monitor, rollback drill, and release | `U9.2` plus owner prerequisites | canary report and rollback evidence |
| `U9.4` | Validate empty-database autonomous first boot | `U9.1`, `U9.2` | clean-DB boot, bootstrap, health, and restart evidence |

**Rule:** if an implementation changes a public API, database document, job payload, environment variable, or embed contract, update the corresponding contract test and migration/rollback note in the same task.

### Autonomous default contract

The implementation must satisfy this contract before `U4.5`, `U5.4`, or `U9.4` can be marked `DONE`:

| Situation | Required behavior | Forbidden behavior |
|---|---|---|
| Empty database | Create only safe, idempotent defaults and schedules; serve the site | Crash, duplicate defaults, or require a setup click |
| Missing optional AI key | Serve public pages; mark AI features disabled; keep drafts/manual flows usable | Boot failure, fake AI success, or silent fallback |
| Missing SMTP/domain auth | Keep acquisition in draft/staging mode; explain the gate | Send anyway or claim delivery |
| Missing payment keys | Show a truthful unavailable/manual path; preserve order state | Grant paid credits as if captured |
| Missing discovery provider | Use remaining configured provider or queued retry; report no-provider state | Infinite retry loop or false “completed” run |
| Provider timeout | Bound the attempt, retry with backoff, quarantine after limit | Block the worker indefinitely |
| Search Console/Bing unavailable | Continue publishing valid sitemap/metadata and record submission retry | Claim indexing or ranking success |
| Compliance uncertainty | Hold the side effect and retain the draft for review | Guess consent or send to a risky region |
| Repeated bad outcomes | Reduce/stop the affected loop and alert | Increase volume automatically |

## 3. Workstream task list

## Workstream 0 — Baseline, branch integration, and release control

- [ ] Commit the current intentional `growth/customer-magnet` changes as a focused commit.
- [ ] Export a file-level diff and commit list for `feat/ai-employee-brand-pricing-blog`.
- [ ] Classify every earlier-branch change as:
  - already present in the current branch;
  - safe to cherry-pick;
  - requiring a manual port;
  - obsolete or superseded.
- [ ] Do not merge branch-wide until shared files have been reconciled:
  - navigation;
  - settings;
  - sitemap/robots/feeds;
  - site configuration;
  - pricing;
  - jobs and schedule;
  - admin layout;
  - authentication;
  - chatbot pages and widget.
- [ ] Create a release branch from the integrated result.
- [ ] Record a baseline of `pnpm verify`, route status, bundle/build output, and current production behavior before each risky migration.
- [ ] Keep unrelated historical Claude session artifacts, credentials, and local transcripts out of the repository.

**Acceptance criteria**

- The integrated branch has no accidental file reversions.
- Every selected commit has a reason and an owner.
- `git diff --check`, typecheck, lint, format check, tests, and build pass before feature work continues.

## Workstream 1 — Authentication, account recovery, and authorization

- [ ] Verify admin login, logout, magic-link, forgot-password, reset-token expiry, token single-use behavior, and invalid-token behavior.
- [ ] Verify customer self-serve signup, login, Google sign-in, session expiry, and unauthorized/forbidden routes.
- [ ] Ensure every chatbot server action checks the correct capability and tenant/user scope.
- [ ] Ensure all chatbot reads and writes scope by `ownerId` and `chatbotId`; add regression tests for cross-tenant access.
- [ ] Ensure public chatbot tokens grant only the intended public operation and never expose private settings, knowledge sources, API keys, or owner data.
- [ ] Verify secure cookie attributes, CSRF/origin protections for server actions, rate limits, and audit records.
- [ ] Add operational recovery instructions for the owner account without recording a production password in documentation.

**Acceptance criteria**

- No unauthenticated request can access admin/customer data.
- A user cannot read, update, delete, rotate, or embed another tenant’s chatbot.
- Reset and magic-link tokens are hashed, expiring, single-use, and not logged.

## Workstream 2 — Brand system and UI/UX quality

- [ ] Reconcile the new logo, favicon, Open Graph images, header, footer, login, admin, and customer dashboard implementations.
- [ ] Replace portfolio gradient/color-block placeholders with verified screenshots or a deliberate branded fallback.
- [ ] Sweep public, admin, and customer pages at mobile, tablet, desktop, light, and dark breakpoints.
- [ ] Standardize loading, empty, error, success, disabled, and permission-denied states.
- [ ] Check keyboard navigation, focus visibility, form labels, contrast, reduced-motion behavior, and screen-reader names.
- [ ] Remove misleading “stored but ignored” controls after the underlying behavior is implemented; retain warnings only for genuinely unavailable features.
- [ ] Add visual regression screenshots for:
  - homepage;
  - service/product pages;
  - pricing;
  - portfolio grid/detail;
  - chatbot dashboard/editor;
  - widget bubble/panel;
  - lead pipeline;
  - proposal portal;
  - mobile navigation.

**Acceptance criteria**

- No bright placeholder blocks appear where a project screenshot or branded fallback is expected.
- Core flows remain usable without hover, mouse, or color perception.
- No console errors, hydration errors, or broken image/icon requests on the route sweep.

## Workstream 3 — Pricing, billing, and commercial correctness

- [ ] Establish one canonical source for service prices, chatbot/form/booking credit packs, currencies, launch pricing, and discounts.
- [ ] Reconcile the earlier price division decision with current production-approved pricing; do not silently change prices during a merge.
- [ ] Verify USD, INR, AUD, and GBP display rules, rounding, currency labels, and calculator/quote consistency.
- [ ] Verify product-scoped permission checks for purchases and credit grants.
- [ ] Complete Razorpay configuration:
  - `RAZORPAY_KEY_ID`;
  - `RAZORPAY_KEY_SECRET`;
  - `RAZORPAY_WEBHOOK_SECRET`.
- [ ] Verify webhook signature validation, idempotency, replay behavior, pending/manual fallback, refund/cancel states, and admin reconciliation.
- [ ] Add a production-safe manual credit grant process with audit logging.
- [ ] Replace any placeholder pricing flag before enabling public checkout.

**Acceptance criteria**

- A successful payment grants exactly the purchased product credits once.
- A duplicate webhook does not double-credit.
- A failed or unconfigured payment never presents a false success.
- Pricing shown in marketing, checkout, admin, and receipts agrees.

## Workstream 4 — Client acquisition and CRM automation

- [ ] Verify discovery providers, location/category filters, deduplication, source attribution, and provider failure handling.
- [ ] Verify website enrichment, email discovery, audit capture, ICP classification, fit scoring, and research briefs.
- [ ] Verify the lead/prospect lifecycle:
  - discovered;
  - enriched;
  - qualified;
  - researched;
  - draft ready;
  - approved;
  - contacted;
  - replied;
  - booked;
  - won/lost/suppressed.
- [ ] Verify pipeline board transitions, optimistic UI failure recovery, audit history, and ownership.
- [ ] Verify one-click “Grab clients now”, saved searches, scheduled jobs, daily caps, idempotency keys, retries, deadline handling, and dead-letter visibility.
- [ ] Keep cold outbound disabled by default until sender identity, postal address, consent policy, domain authentication, and suppression are configured.
- [ ] Verify country/region rules and manual release requirements for Australia and the United Kingdom.
- [ ] Add safe staging mode that generates drafts and reports but cannot send.
- [ ] Add a measurable funnel dashboard:
  - discovered;
  - qualified;
  - contacted;
  - delivered;
  - opened;
  - replied;
  - booked;
  - converted;
  - unsubscribed;
  - suppressed.
- [ ] Make the safe acquisition loop autonomous after deployment:
  - bootstrap the default discovery schedule and growth settings on first server run;
  - create missing job indexes/config records idempotently;
  - discover from the configured default markets/categories without a setup wizard;
  - enrich, audit, classify, research, and draft automatically within hard daily budgets;
  - auto-enroll only prospects that pass the configured safety/compliance rules;
  - keep external sending in a no-send/draft mode until sender credentials, postal address, domain authentication, and legal region requirements are demonstrably satisfied;
  - automatically resume after transient failures with bounded exponential backoff;
  - automatically pause a failing provider, alert the owner, and continue using the next safe provider;
  - never retry a commercial send unless the message has a durable idempotency key.
- [ ] Provide a deterministic first-run bootstrap:
  - safe defaults are created with `upsert`, never duplicated;
  - the heartbeat/cron endpoint can reconcile missing schedules;
  - the worker can start with an empty database;
  - every default can be overridden later from admin settings;
  - bootstrap is observable and has a dry-run/test mode.
- [ ] Optimize acquisition for quality and volume separately:
  - use broad discovery for candidate volume;
  - use strict ICP/audit thresholds for contact eligibility;
  - prioritize high-fit, high-intent, reachable prospects;
  - diversify by market, industry, and source;
  - enforce per-domain, per-recipient, per-region, and daily reputation caps;
  - learn from reply, booking, conversion, bounce, unsubscribe, and suppression outcomes without using protected or sensitive attributes.

**Acceptance criteria**

- No duplicate first-contact message can be generated or sent.
- Every commercial message has an unsubscribe path and suppression check.
- The owner can inspect and approve a batch before any external send.
- A failed provider/job leaves an explicit, retryable state rather than silently disappearing.
- A fresh deployment with an empty application database creates safe schedules and can run discovery/drafting without a manual first-time configuration flow.
- Missing optional credentials never crash the application; they produce an explicit disabled capability and a next-action health message.
- Autonomous mode never sends non-compliant or unapproved commercial mail.

## Workstream 5 — Content, blog, SEO, GEO, and conversion

- [ ] Reconcile static and database-backed blog content, slugs, canonical URLs, publication status, drafts, revisions, feeds, sitemap, and IndexNow.
- [ ] Add or verify title, description, canonical, Open Graph, Twitter, robots, and JSON-LD metadata for every public route.
- [ ] Verify `Organization`, `ProfessionalService`, `SoftwareApplication`, `FAQPage`, `BreadcrumbList`, and product/service schemas where applicable.
- [ ] Verify geographic claims and `areaServed` values against the actual business decision.
- [ ] Ensure `llms.txt`, robots, sitemap, RSS/Atom, and public navigation expose only published, canonical content.
- [ ] Ensure draft, preview, admin, tokenized, and private portal routes are not indexable.
- [ ] Add redirects for duplicate/legacy AI and blog URLs.
- [ ] Verify internal links, related resources, FAQ answers, and citation-ready “when to choose Bitecodes” content.
- [ ] Add conversion tracking for primary CTAs, resource gates, demo usage, booking starts/completions, signup, checkout, and proposal acceptance.
- [ ] Run Google Search Console/Bing verification after deployment and inspect structured-data reports.
- [ ] Build an autonomous search-growth loop:
  - generate or select topics from verified service demand, Search Console/Bing data when available, internal search, support questions, lead objections, and competitor content gaps;
  - reject topics that are duplicative, unsupported by first-party evidence, legally risky, or intended only to manipulate rankings;
  - draft useful content with human-readable sources, examples, limitations, FAQs, author/date metadata, and strong internal links;
  - validate claims against canonical site data before publication;
  - publish only when quality, duplication, metadata, link, and indexability checks pass;
  - update or retire stale pages based on measured performance rather than producing unlimited thin pages;
  - submit eligible canonical URLs to sitemap/IndexNow and record failures for retry;
  - measure impressions, clicks, ranking distribution, qualified leads, booked calls, and assisted conversions by page/topic.
- [ ] Create a programmatic SEO policy before adding location/industry pages:
  - every page must contain materially unique, useful local/industry information;
  - no doorway pages, spun text, fake local offices, fabricated case studies, or copied competitor content;
  - pages with insufficient unique value stay unpublished or canonicalize to a stronger parent.
- [ ] Create a GEO/AEO content policy:
  - expose clear entity identity, services, markets, prices where approved, qualifications, evidence, contact channels, and update dates;
  - use consistent organization/service/product/schema facts across HTML, JSON-LD, feeds, `llms.txt`, and public documentation;
  - publish concise answer blocks followed by supporting detail and source links;
  - make claims citation-ready and easy for retrieval systems to attribute;
  - monitor AI-answer mentions as a measurement, never as a guaranteed ranking promise.
- [ ] Add automatic SEO health checks to the scheduled jobs:
  - broken links;
  - missing/duplicate titles and descriptions;
  - canonical conflicts;
  - noindex/indexability mistakes;
  - orphan pages;
  - sitemap drift;
  - invalid structured data;
  - slow or failing assets;
  - stale content;
  - accidental private-data exposure.
- [ ] Add a conversion-quality feedback loop so SEO optimization targets qualified customers, not vanity traffic:
  - distinguish bot/low-quality traffic from real engagement;
  - attribute first touch, last touch, and assisted touch;
  - identify pages producing qualified leads and booked calls;
  - automatically recommend content/CTA/internal-link improvements;
  - protect against optimizing toward spam, irrelevant traffic, or low-value form submissions.

**Acceptance criteria**

- No private/admin/draft route is indexable.
- Every public canonical route has valid metadata and no duplicate canonical conflict.
- Sitemap contains all intended public pages and no private/dynamic noise.
- SEO validation reports no fatal structured-data errors.
- A fresh deployment exposes a crawlable, canonical, fast public site with no manual content-entry requirement for the baseline pages.
- The autonomous content loop can safely produce a draft from configured first-party inputs, but cannot auto-publish unsupported, duplicate, private, or low-quality content.
- Every ranking/acquisition experiment has a measurable hypothesis, baseline, owner, stop condition, and rollback.
- Release documentation states clearly that ranking position is an external outcome and cannot be guaranteed.

## Workstream 6 — AI Chatbot product correctness

- [ ] Verify chatbot creation, update, pause/resume, deletion, public-token rotation, API-key creation/revocation, model selection, and allowed-domain validation.
- [ ] Verify the free-tier grant and all deductions use one shared unit definition; prevent the historical raw-token/reply mismatch.
- [ ] Make token deduction atomic and idempotent under concurrent requests.
- [ ] Add insufficient-credit, paused-bot, invalid-token, domain-denied, rate-limited, model-unavailable, and provider-timeout responses.
- [ ] Verify streaming response framing, disconnect cleanup, timeout behavior, usage recording, and no token leakage on failed generations.
- [ ] Verify retrieval relevance and honest “I do not know” behavior when no source meets the threshold.
- [ ] Verify chunking, ingestion status, failed-source retry, URL/sitemap ingestion, manual FAQs, and reindex behavior.
- [ ] Add prompt-injection boundaries:
  - never treat retrieved content as system instructions;
  - never expose hidden prompts, tokens, internal URLs, or other tenants’ data;
  - cap input/output sizes;
  - redact sensitive logging.
- [ ] Add abuse controls: per-IP/per-token limits, origin checks, request size limits, concurrency limits, and provider budget ceilings.
- [ ] Add customer-visible usage and failure explanations.

**Acceptance criteria**

- A successful assistant turn deducts the documented amount exactly once.
- A failed or cancelled turn does not charge incorrectly.
- Concurrent requests cannot create negative balances or double deductions.
- Unmatched questions receive an honest fallback, not an unrelated retrieved answer.
- No private chatbot data is observable through the public API or widget.

## Workstream 7 — Chatbot appearance, emoji, and widget customization

This is the specifically identified unfinished feature from the earlier Claude session.

- [ ] Define the public appearance contract before editing the widget:
  - `emoji` or icon identifier;
  - optional custom SVG/image policy;
  - launcher label/accessible name;
  - theme;
  - primary and secondary colors;
  - position;
  - size;
  - display mode;
  - logo/avatar;
  - welcome message;
  - placeholder;
  - typing animation;
  - branding;
  - suggested questions/starter prompts.
- [ ] Choose a safe emoji model:
  - allowlist Unicode emoji strings or named built-in icons;
  - reject arbitrary HTML/SVG from customer input;
  - preserve a deterministic fallback;
  - validate length, grapheme count, and control characters.
- [ ] Extend the server action schema, repository defaults, public config response, and tests for the new field.
- [ ] Implement widget rendering for:
  - launcher emoji/icon;
  - `secondaryColor`;
  - compact/regular/large sizes;
  - bottom-left/bottom-right;
  - light/dark/auto themes;
  - branding toggle;
  - typing indicator toggle;
  - welcome message and placeholder.
- [ ] Implement display modes deliberately:
  - bubble: floating launcher and panel;
  - popup: panel visible without a launcher when configured;
  - fullscreen: responsive viewport-safe panel;
  - embedded: mount into a host element without fixed positioning.
- [ ] Define and document the embed API for display mode and host element selection.
- [ ] Add suggested-question/starter-prompt rendering with safe text handling and click-to-submit behavior.
- [ ] Add language/timezone behavior only where the product has a defined translation/time policy; do not expose nonfunctional controls.
- [ ] Update the admin editor:
  - emoji picker/allowlist;
  - explicit labels and examples;
  - live preview parity with widget output;
  - validation errors;
  - unsaved-change guard;
  - reset-to-default;
  - mobile editor layout.
- [ ] Add a compatibility/version strategy for generated widget scripts so an old embed does not break when config fields evolve.
- [ ] Add widget tests for XSS-safe input, config fallback, rendering modes, keyboard operation, mobile viewport, and appearance parity.
- [ ] Test the exact customer embed snippet against allowed and denied origins.

**Acceptance criteria**

- Saving an emoji changes the launcher on a fresh embed load.
- Invalid emoji/icon input is rejected server-side and cannot inject markup, CSS, or scripts.
- All advertised appearance controls either work in the widget or are not shown as configurable.
- The preview and deployed widget render the same configuration.
- Existing customer embeds remain functional when new appearance fields are absent.
- Widget bundle/runtime errors are zero in supported browsers.

## Workstream 8 — Analytics, reporting, lifecycle, and retention

- [ ] Verify cookieless analytics event collection, visitor hashing, consent behavior, retention, and aggregation.
- [ ] Verify analytics dashboard totals, date ranges, unique visitors, pageviews, CTA clicks, forms, campaigns, and web vitals.
- [ ] Verify lead, prospect, email, job, chatbot, and billing metrics use consistent time windows and timezone semantics.
- [ ] Verify daily digest, weekly report, and monthly report read real data and send through the internal queue.
- [ ] Verify report recipients, missing-recipient behavior, email failures, and idempotent retry behavior.
- [ ] Verify churn scoring, feedback requests, NPS/testimonials, referrals, lifecycle events, and customer-health dashboards.
- [ ] Add alerting for:
  - job dead letters;
  - provider failures;
  - billing webhook failures;
  - email delivery failures;
  - token-deduction anomalies;
  - widget error spikes.

**Acceptance criteria**

- Reports never show success-shaped zeros when a source query failed.
- Every report identifies its period and timezone.
- A failed report/email is observable and retryable.
- Dashboard figures reconcile with source collections for a known fixture dataset.

## Workstream 9 — Operations, compliance, security, and release readiness

- [ ] Create a production environment matrix with required/optional variables and owners.
- [ ] Configure secrets only in Vercel/GitHub/provider secret stores; never commit or paste them into source/docs.
- [ ] Configure:
  - `AUTH_SECRET`;
  - `CRON_SECRET`;
  - `MONGODB_URI`;
  - `TEST_MONGODB_URI` for CI;
  - AI provider keys and fallback order;
  - SMTP and notification recipients;
  - payment credentials/webhook secret;
  - signing/URL secrets;
  - Search Console/Bing/IndexNow values;
  - optional telephony credentials.
- [ ] Configure SPF, DKIM, DMARC, sender identity, postal address, unsubscribe handling, and suppression retention before enabling outbound marketing.
- [ ] Review privacy, data retention, deletion/export, consent, cookie/analytics, AI provider, and third-party disclosure copy.
- [ ] Run dependency, secret, endpoint, authorization, rate-limit, SSRF, XSS, CSRF, prompt-injection, and tenant-isolation reviews.
- [ ] Add backup/restore verification for MongoDB and document migration/index procedures.
- [ ] Define incident runbooks for:
  - widget rollback;
  - provider outage;
  - runaway job;
  - accidental outbound batch;
  - token/billing discrepancy;
  - compromised API key;
  - database restore.
- [ ] Run a canary deployment before broad production traffic.
- [ ] Make operations self-healing where safe:
  - bootstrap indexes and default records idempotently;
  - verify scheduled jobs on every heartbeat;
  - renew/retry transient provider operations within deadlines;
  - quarantine poison jobs after bounded attempts;
  - pause only the affected capability when a dependency fails;
  - expose a health summary with exact remediation, not a generic “setup required” message;
  - keep all autonomous actions auditable and reversible.
- [ ] Define a no-credential first deployment profile:
  - public marketing pages, SEO metadata, sitemap, analytics-safe mode, local draft generation, and health checks work without optional providers;
  - AI, SMTP, payment, external discovery, and outbound sending degrade to explicit disabled states;
  - the site remains deployable and useful rather than failing boot because one integration is absent.

**Acceptance criteria**

- Security review has no unresolved critical/high findings.
- Rollback commands and feature-toggle kill switches are tested.
- Production health checks, logs, metrics, and alerts are observable by the owner.
- No feature is enabled merely because code exists; enablement requires its configuration gate.
- A clean deployment requires no manual first-run UI action to boot, serve public pages, create default schedules, or report health.
- Every unavailable integration has a safe fallback, an explicit reason, a retry/activation path, and an owner-visible status.

## 4. Dependency-ordered implementation phases

### Phase A — Protect the baseline

- [ ] Commit/stabilize current growth-engine changes.
- [ ] Create an integration branch.
- [ ] Capture baseline verification and production route behavior.
- [ ] Reconcile earlier Claude branch changes.
- [ ] Decide canonical pricing, contact details, logo/brand assets, markets, and public claims.

### Phase B — Foundations and data correctness

- [ ] Complete auth/authorization tests.
- [ ] Complete billing/token ledger invariants.
- [ ] Add/verify schema indexes and migrations.
- [ ] Add feature flags and kill switches for widget modes, outbound email, autopilot, AI blog, and checkout.
- [ ] Add structured audit events for high-impact mutations.

### Phase C — Customer acquisition and conversion

- [ ] Finish CRM lifecycle and pipeline behavior.
- [ ] Finish discovery/enrichment/audit/research/draft flows.
- [ ] Add staging mode and approval queue.
- [ ] Add funnel analytics and conversion events.
- [ ] Verify booking, proposal, referral, newsletter, and resource-gate flows.

### Phase D — Public site, SEO, and UX

- [ ] Integrate brand/logo/portfolio work.
- [ ] Complete pricing and international copy reconciliation.
- [ ] Complete blog/content/metadata/schema/sitemap/feed work.
- [ ] Run accessibility and responsive UI sweep.
- [ ] Run browser route and console-error sweep.

### Phase E — Chatbot product hardening

- [ ] Verify chat API, retrieval, streaming, token accounting, and abuse controls.
- [ ] Implement emoji/icon and all supported appearance fields.
- [ ] Implement and test widget display modes.
- [ ] Add preview parity and embed compatibility/versioning.
- [ ] Run real-browser widget tests against a disposable test chatbot.

### Phase F — Reporting, operations, and production configuration

- [ ] Verify analytics, daily/weekly/monthly reporting, lifecycle, churn, feedback, and referrals.
- [ ] Configure production secrets and third-party providers.
- [ ] Configure email/domain/payment/AI operational requirements.
- [ ] Run security review, integration tests, canary, smoke tests, and rollback drill.

### Phase G — Autonomous growth and search compounding

- [ ] Enable idempotent first-run bootstrap and heartbeat reconciliation.
- [ ] Enable autonomous discovery, enrichment, audit, scoring, research, and draft generation within budgets.
- [ ] Keep external sends disabled until all compliance and deliverability gates pass; then release gradually by approved region and batch.
- [ ] Enable autonomous SEO audits, content-gap recommendations, internal-link suggestions, sitemap/IndexNow updates, and stale-content maintenance.
- [ ] Publish only quality-gated content backed by first-party facts and canonical metadata.
- [ ] Review weekly qualified-lead, booked-call, conversion, search-impression, click, and assisted-conversion trends.
- [ ] Stop or roll back any loop that increases spam, bounces, complaints, irrelevant traffic, duplicate content, or unqualified leads.

## 5. Required validation matrix

### Automated

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm format:check`
- [ ] `TEST_MONGODB_URI=... pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm verify`
- [ ] Browser tests for core public, admin, customer, checkout, proposal, and widget routes.
- [ ] Contract tests for public chatbot config and API responses.
- [ ] Concurrency tests for token deduction and webhook idempotency.

### Manual/browser

- [ ] New visitor: homepage → service/product → CTA → lead/signup.
- [ ] Customer: signup → dashboard → create chatbot → configure → copy embed → load on allowed domain.
- [ ] Customer: edit emoji/colors/mode → save → reload widget → verify parity.
- [ ] Visitor: ask grounded and ungrounded questions; verify safe answers and usage.
- [ ] Owner: discover prospects → audit → qualify → stage draft → approve → inspect outcome.
- [ ] Owner: inspect analytics, job queue, reports, customer health, and failed states.
- [ ] Mobile and keyboard pass for all critical flows.

### Production smoke

- [ ] Verify deployment version and build identifier.
- [ ] Verify public routes return expected status codes.
- [ ] Verify sitemap, robots, feeds, `llms.txt`, and metadata.
- [ ] Verify widget loader, config, CORS/origin, chat stream, and error fallback.
- [ ] Verify payment test/live mode according to provider procedure.
- [ ] Verify email test message, unsubscribe, tracking, and suppression.
- [ ] Verify cron authorization and one idempotent heartbeat.

## 6. Rollout and rollback strategy

1. **Deploy dark:** ship code with new capabilities disabled.
2. **Canary internal:** enable for owner/test accounts only.
3. **Widget canary:** enable new widget appearance contract for one disposable chatbot and one controlled customer.
4. **Billing canary:** use provider test mode and reconcile ledger/webhook results.
5. **Acquisition canary:** discovery and draft generation only; no external sends.
6. **Outbound release:** enable one approved batch after deliverability/compliance checks.
7. **Broaden gradually:** expand by product, tenant, provider, and geography.
8. **Monitor:** errors, latency, token balance anomalies, job failures, email bounces, conversions, and support reports.
9. **Autonomous default:** after the canary is healthy, the heartbeat reconciles schedules and safe defaults automatically; no first-run checklist click is required for code-controlled capabilities.
10. **Progressive autonomy:** drafting and measurement start automatically; external side effects (commercial sends, live billing, publication of AI-generated claims) unlock only after their objective gates pass.

Rollback controls must include:

- [ ] Widget script/version rollback.
- [ ] Feature-toggle disablement.
- [ ] Cron/job pause.
- [ ] Outbound-send approval gate.
- [ ] Payment provider fallback/manual reconciliation.
- [ ] AI provider fallback.
- [ ] Database backup restore procedure.

## 7. Owner-only prerequisites

These cannot be completed safely by code changes alone:

- [ ] Confirm final prices, launch discounts, currencies, guarantees, portfolio claims, and contact identity.
- [ ] Configure Vercel/GitHub secrets and production environment variables.
- [ ] Configure MongoDB/Atlas, backups, indexes, and any Vector Search/Redis infrastructure.
- [ ] Configure AI provider keys, model fallback order, budgets, and data-processing policy.
- [ ] Configure SMTP, sender identity, SPF, DKIM, DMARC, postal address, and notification recipients.
- [ ] Configure Razorpay keys and webhook secret.
- [ ] Verify Google Search Console, Bing Webmaster Tools, IndexNow, and business directories.
- [ ] Approve LinkedIn OAuth/manual actions if LinkedIn automation is used.
- [ ] Approve Australia/UK outreach policy and consent process.
- [ ] Review privacy, terms, consent, retention, deletion, and customer-data disclosures.
- [ ] Manually reconcile any customer balances affected by historical token-accounting bugs.

> These prerequisites are not a first-run configuration requirement for the public site. They are activation gates for capabilities that inherently require an external account, legal approval, DNS control, or a business decision. The application must boot and provide useful public/diagnostic behavior without them.

## 8. Definition of done

The upgrade may be marked complete only when:

- [ ] All workstream acceptance criteria pass.
- [ ] No known critical/high security or tenant-isolation issue remains.
- [ ] No advertised control is nonfunctional or misleading.
- [ ] Integration MongoDB tests have run, not merely been skipped.
- [ ] Production build and route/browser smoke tests pass.
- [ ] Production secrets and owner prerequisites are recorded as configured or explicitly deferred.
- [ ] A canary was observed with no regression.
- [ ] Rollback was tested or demonstrably executable.
- [ ] The final release notes identify code changes, configuration changes, migrations, known limitations, and monitoring owners.
- [ ] A fresh empty-database deployment was tested: public site works, safe defaults/bootstrap run, health reports missing integrations, and no manual first-run wizard is required.
- [ ] Autonomous discovery/drafting and SEO health loops were run repeatedly with the same inputs to prove idempotency and bounded growth.
- [ ] External side-effect gates were tested closed and open; closed gates produced zero sends/publishes/charges.
- [ ] Search-growth reporting distinguishes implemented signals from external ranking outcomes and contains no guarantee of “top” placement.

## 9. Repository execution map

Use these locations first. If a required symbol has moved, search by symbol name and update the task record; do not create a duplicate implementation.

| Area | Primary locations | Existing tests/validation |
|---|---|---|
| Site identity/SEO | `src/lib/site.ts`, `src/lib/seo.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/llms.txt/`, `src/data/navigation.ts` | `src/app/llms.test.ts`, sitemap/route tests |
| Public pages | `src/app/(site)/`, `src/components/`, `src/data/` | route smoke/build |
| Admin auth | `src/app/admin/`, `src/lib/server/auth/`, `src/lib/server/admin/` | auth tests and browser flow |
| Customer auth | `src/app/(auth)/`, `src/app/app/`, `src/lib/server/auth/` | auth/session tests |
| Chatbot model | `src/lib/server/db/types.ts`, `src/lib/server/db/schema.ts`, `src/lib/server/db/collections.ts` | repository/model tests |
| Chatbot server | `src/lib/server/chatbot/`, `src/app/api/v1/chatbots/` | chatbot/API contract tests |
| Chatbot customer UI | `src/app/app/(dash)/chatbots/`, `src/components/admin/chatbot-*.tsx` | component/browser tests |
| Embed widget | `src/app/widget.js/route.ts`, `src/app/widget-origin.test.ts`, `src/app/api/v1/chatbots/[chatbotId]/config/route.ts` | widget origin/config/browser tests |
| Token/billing | `src/lib/server/billing/`, `src/lib/server/wallet/`, billing routes | ledger/webhook tests |
| Knowledge/RAG | `src/lib/chatbot/`, `src/lib/server/knowledge/` | chunk/extract/retrieval tests |
| Growth jobs | `src/lib/server/jobs/`, `src/lib/server/jobs/handlers/`, `src/lib/server/jobs/schedule.ts` | handler/schedule/worker tests |
| Leads/CRM | `src/lib/server/leads/`, `src/lib/server/prospecting/`, admin lead pages | repository/action/job tests |
| Email/compliance | `src/lib/server/email/`, `src/lib/server/settings.ts`, `.env.example` | email/compliance tests |
| Analytics | `src/lib/server/analytics/`, `src/app/api/analytics/`, admin analytics | analytics repository/tests |
| Reports/retention | `src/lib/server/digest/`, `src/lib/server/jobs/handlers/report-*`, lifecycle/referrals/feedback | focused handler tests |

## 10. Data, migration, and compatibility rules

1. **No destructive migration in an application deploy.** Add fields/indexes in backward-compatible form first; remove old fields only after one verified release has stopped reading them.
2. **Default every new persisted field.** Existing chatbot documents must continue to work when the field is absent. Resolve defaults in one repository/config normalizer, not independently in the editor and widget.
3. **Use expand/migrate/contract:**
   - expand schema and readers to accept old and new forms;
   - backfill in a bounded, resumable job;
   - verify counts and sampled documents;
   - switch writers;
   - contract only in a later release.
4. **Index changes must be reviewed for production cost.** Create indexes in a controlled migration/setup command, confirm with `explain`, and document rollback/drop instructions.
5. **Never store secrets, raw public tokens, reset tokens, API keys, or full payment payloads.** Store hashes or provider IDs with the minimum required metadata.
6. **Job payloads are versioned.** A worker must accept the previous payload shape during a rolling deployment; add `payloadVersion` when a breaking change is unavoidable.
7. **Embed compatibility is mandatory.** Missing config fields must resolve to the old safe behavior. A new widget must not assume a new field exists in an old chatbot document.
8. **Public API compatibility is explicit.** Add response fields without removing/renaming existing fields; version a breaking change under a new route/version.
9. **Time is UTC in storage and job windows.** Convert only at presentation boundaries and test midnight, DST, and timezone edge cases.
10. **Money is integer minor units.** Never use floating-point arithmetic for prices, credits, refunds, or webhook comparisons.

### Required migration record

For every schema/index/field change, add this to the PR description:

```text
Migration ID:
Collections/indexes:
Old shape accepted:
New shape written:
Backfill command/job:
Batch size and resume key:
Expected duration:
Verification query:
Rollback:
Removal release (if any):
```

## 11. Failure-handling and observability contract

Every new route, action, job, provider call, and widget request must define:

- input validation and maximum size;
- authentication/authorization decision;
- timeout and cancellation behavior;
- retry policy and idempotency key;
- user-safe error response;
- operator-visible structured log;
- metric/counter and alert threshold;
- redaction rules;
- rollback/kill switch.

### Logging rules

- Log event name, stable entity ID, job/request ID, outcome, duration, and safe error code.
- Never log passwords, tokens, API keys, email message bodies, retrieved private content, or raw visitor identifiers.
- Use the repository’s existing logging/audit helpers; do not add ad-hoc `console.log` for security-sensitive paths.
- Preserve the original error for server logs while returning a stable, non-sensitive message to clients.

### Minimum metrics

- HTTP status and latency by route.
- Widget config/chat request success, denial, timeout, and provider failure.
- Token debit success, rejection, refund, and balance anomaly.
- Job queued/running/succeeded/retried/failed/dead-lettered.
- Email queued/sent/bounced/suppressed/unsubscribed.
- Payment created/authorized/captured/failed/refunded/webhook-replayed.
- Acquisition funnel counts by source and date window.

## 12. Test fixture and environment protocol

Before integration tests:

1. Use a disposable database/database name. Never point tests at production.
2. Set `TEST_MONGODB_URI`; if it is absent, integration tests are **BLOCKED**, not passed.
3. Seed deterministic users, two owners, two chatbots, knowledge sources, wallet rows, leads, email messages, and jobs.
4. Use fixed dates in fixtures. Do not assert against `Date.now()` without a fake clock.
5. Clean collections after each suite or use isolated database names.
6. Test both owner A and owner B for every tenant-scoped read/write.
7. Run concurrency tests with enough parallel operations to exercise atomicity.
8. Preserve failing database state only in a local disposable database; never export customer data.

Required negative cases:

- unauthenticated;
- authenticated but wrong capability;
- authenticated owner of a different tenant;
- malformed input;
- oversized input;
- expired/replayed token;
- denied origin/domain;
- paused/deleted resource;
- duplicate webhook/job/request;
- provider timeout/non-2xx/malformed response;
- database write failure after an external provider response;
- client disconnect during a streamed response.

## 13. Release gates and sign-off

A release manager must sign each gate in order:

| Gate | Pass condition | Sign-off |
|---|---|---|
| G0 Scope | Task register has no unknown status; blockers have owners | engineer |
| G1 Code | lint, typecheck, format, focused tests pass | engineer |
| G2 Integration | disposable MongoDB integration suite passes; no skipped required tests | engineer |
| G3 Security | tenant isolation, abuse, secret, XSS/CSRF/SSRF/prompt-injection review passes | security reviewer |
| G4 UX | keyboard/mobile/dark/light/error/empty flows pass | product/UX owner |
| G5 Commercial | prices, payment test, ledger/webhook reconciliation pass | business owner |
| G6 Operations | secrets, email/domain, AI provider, cron, alerts, backups verified | operations owner |
| G7 Canary | controlled rollout stable for the agreed observation window | release owner |
| G8 Release | smoke tests pass and rollback is executable | release owner |

If a gate fails, stop the release, record the failure and evidence, disable the affected feature flag, and return to the owning task. Do not waive a gate by editing the checklist.

## 14. Deferred findings policy

Any item not completed must be listed explicitly with:

```text
Finding:
Why it is deferred:
Affected users/data:
Risk severity:
Temporary mitigation:
Owner:
Target release/date:
How it will be verified:
```

“Not tested”, “works locally”, “requires credentials”, and “low priority” are not completion statements. They are either a blocker or a documented deferral.

## 15. Autonomous growth scorecard

The purpose of autonomy is compounding qualified demand, not generating activity for its own sake. Record these metrics weekly with the exact date window and source query:

### Acquisition

- qualified prospects discovered;
- reachable prospects;
- research briefs completed;
- drafts generated;
- drafts approved;
- messages delivered;
- bounces and complaints;
- replies;
- positive replies;
- booked calls;
- proposals sent;
- proposals accepted;
- won revenue;
- unsubscribe/suppression rate;
- cost per qualified opportunity.

### Search and GEO

- indexed canonical URLs;
- crawl/index errors;
- impressions and clicks by landing page;
- ranking distribution (top 3, top 10, top 20, not ranking);
- qualified leads by organic landing page;
- assisted conversions;
- branded versus non-branded demand;
- citations/mentions detected in monitored AI-answer samples;
- content freshness and duplicate-content findings;
- Core Web Vitals and route performance.

### Autonomy health

- first-boot bootstrap success;
- schedules reconciled;
- jobs completed/retried/dead-lettered;
- provider failure rate;
- side effects held by safety gates;
- duplicate/idempotency conflicts;
- manual interventions required;
- disabled capabilities and exact reasons.

### Required stop conditions

Pause the affected automation and create an owner alert when any of these occur:

- bounce, complaint, unsubscribe, or suppression rate exceeds the configured policy threshold;
- provider/API cost exceeds its budget;
- duplicate side effects or ledger anomalies are detected;
- a job repeatedly fails or exceeds its deadline;
- content quality checks fail consecutively;
- duplicate/thin pages increase;
- organic traffic rises while qualified conversion quality falls beyond the agreed tolerance;
- a security, privacy, consent, or tenant-isolation signal appears.

Do not optimize for raw pageviews, total emails, total generated articles, or “top ranking” screenshots without qualified-conversion and safety metrics.

## 16. Explicit non-guarantees

The plan must not promise outcomes controlled by third parties or by market behavior:

- first place or any fixed position in Google, Bing, or AI answers;
- a guaranteed number of clients, leads, replies, bookings, or revenue;
- guaranteed email delivery or inbox placement;
- guaranteed model availability, latency, or answer quality;
- automatic legal consent for outreach;
- automatic creation of DNS records, payment accounts, provider accounts, or business listings.

The engineering commitment is stronger and testable: maximize eligible visibility and qualified demand, automate safe work by default, measure every step, stop harmful loops, and make every external dependency explicit.

## 17. Customer-Magnet release — five acquisition surfaces

Shipped on `main` after the reliability and GEO hardening programme. Each surface is a real, working asset rather than a landing-page claim, and each captures a lead only with explicit consent.

1. **AI visibility check** (`/ai-visibility-check`) — three bounded, SSRF-guarded fetches (homepage, `robots.txt`, `llms.txt`), seven weighted signals, a named crawler-permission list, and three prioritised fixes. Rate-limited API; optional emailed report that re-runs the scan server-side rather than trusting browser-posted scores.
2. **Answer library** (`/answers`) — fifteen answer-first pages covering cost, hiring, delivery, products, and AI search. Every page opens with a complete quotable answer, carries FAQPage/WebPage JSON-LD, and links to the calculators and services that continue the intent.
3. **Honest comparison hub** (`/compare`) — five decision-stage comparisons (freelancer, agency, Wix/Squarespace, Webflow, in-house). Copy states where the alternative wins, uses semantic tables, and cross-links to related answers.
4. **Revenue leak calculator** (`/revenue-leak-calculator`) — transparent funnel arithmetic, a stated 3% enquiry-rate reference point, three uplift scenarios, and an emailed estimate. The server recomputes every figure; the copy explicitly calls it arithmetic, not a forecast.
5. **Launch templates** (`/templates`) — three original design directions (clinic, restaurant, SaaS) with interactive desktop/phone previews. Clearly labelled as paid starting points, not downloadable themes.

Discovery wiring: sitemap entries for all hubs and detail pages; `llms.txt` and `llms-full.txt` sections with quotable summaries; tools hub, footer, and internal cross-links; WebApplication, WebPage, FAQPage, Question, and BreadcrumbList structured data.

Verification evidence at release time:

- `pnpm format:check`, `pnpm typecheck`, and `pnpm lint` pass.
- Full Vitest suite (with MongoDB): 134 files, 1,605 passed, 6 skipped; the single price-provenance failure found earlier was fixed by sourcing answer-library price bands from `answers.ts`.
- `pnpm build` completes; all five hubs and every detail page are prerendered or dynamically served as intended.
- Local checks: SSRF rejection for `localhost` and `127.0.0.1` (400), oversize body rejection (413), invalid email rejection (400), sitemap/llms coverage confirmed, JSON-LD present on every new page.
- Production checks after deploying commit `9c067eb` to `main` (Vercel status success):
  - `GET` 200 for `/ai-visibility-check`, `/revenue-leak-calculator`, `/answers`, `/compare`, `/templates`, plus sampled detail pages `/answers/how-much-does-a-website-cost`, `/compare/bitecodes-vs-freelancer`, `/templates/harbour-clinic`, `/templates/ember-table`, `/templates/northwind`.
  - Live API `POST /api/ai-visibility` with `example.com` returned `{ ok: true, score: 40, grade: "weak" }`; `localhost` returned 400 with the blocked-URL message.
  - Browser run of the live AI visibility check: filled `example.com`, clicked “Check visibility”, result panel rendered score 40/100, 9/9 crawlers allowed, 2/7 checks passed, three prioritised fixes, and a prefilled contact link; no console messages.
  - Browser run of the live revenue leak calculator: default inputs produce $28,125/month and $337,500/year, with the 3% reference point adding $28,125/month; figures match the documented arithmetic.
  - Browser run of live `/templates/harbour-clinic`: content rendered without a loading state, one H1, five JSON-LD blocks, correct canonical.
  - `sitemap.xml` contains all new hubs and detail routes; `llms.txt` lists both growth tools; `llms-full.txt` carries the answer, comparison, and template sections; every new page exposes title, canonical, description, and 4–6 JSON-LD blocks.
