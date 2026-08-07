# AI Chatbot SaaS — Production Architecture & Build Plan

A multi-tenant, embeddable AI chatbot platform built **inside the existing
Bitecodes application**, reusing its authentication, MongoDB data layer,
background-job queue, settings, rate limiter, email, and admin panel. This
document is the engineering plan; the customer-facing product page lives at
`/ai-chatbot`.

> Design goal: modular, extensible, secure, multi-tenant, production-ready,
> with clean separation of concerns. Ship an MVP fast on the existing stack,
> then scale the hot paths (chat + retrieval) independently.

---

## 1. High-level system architecture

```
                         ┌──────────────────────────────────────────┐
  End-user's website     │            Bitecodes platform             │
  ┌───────────────┐      │                                            │
  │  widget.js /   │ SSE  │  Edge/CDN ─► Chat Gateway (Next route     │
  │  <iframe>      │◄────►│              handler, streaming SSE)       │
  └───────────────┘      │        │                                   │
                         │        ▼                                   │
  Customer (owner)       │   Rate limit ─► Auth (public token +       │
  ┌───────────────┐      │   (Mongo/     domain allowlist)            │
  │ User dashboard│◄────►│    Redis)      │                           │
  │ Admin panel   │ JWT/ │                ▼                           │
  └───────────────┘ sess │           RAG orchestrator                 │
                         │        ┌───────┴────────┐                  │
                         │        ▼                ▼                  │
                         │   Vector search    LLM provider(s)         │
                         │   (Atlas Vector   (OpenAI-compatible:      │
                         │    Search)         OpenRouter, etc.)        │
                         │        ▲                                   │
                         │   Ingestion workers (jobs queue):          │
                         │   crawl → extract → chunk → embed → store  │
                         │                                            │
                         │   MongoDB (tenants, bots, KB, chats,       │
                         │   tokens, billing) · Redis (cache/queue)   │
                         └──────────────────────────────────────────┘
```

**Tenancy model:** every row carries `ownerId` (the existing `AdminUserDoc`/
customer id) and, where relevant, `chatbotId`. All queries are scoped by
`ownerId`; the widget path is scoped by `chatbotId` + a public token that only
grants *chat*, never management. This is row-level multi-tenancy on the shared
Mongo database already in use — no new datastore required for the MVP.

**Reused building blocks (already in the repo):**
- Auth & sessions — `src/lib/server/auth/*` (opaque hashed sessions, roles, TOTP).
- Jobs queue & worker — `src/lib/server/jobs/*` (`enqueueJob`, `kickJobs`,
  idempotency keys, retries/backoff). Ingestion and embedding run here.
- Cron tick — `src/app/api/cron/run/route.ts` drives recurring work.
- Settings — `src/lib/server/settings.ts` (per-install config, cached).
- Rate limiting — `src/lib/server/rate-limit.ts` (Mongo-backed fixed window).
- Signed tokens — `src/lib/server/tokens.ts` (HMAC, purpose-scoped) for public
  widget tokens and unsubscribe/verification links.
- Email — `src/lib/server/email/*` for notifications (tokens low, indexed…).
- AI provider — `src/lib/server/ai-provider.ts` (`createStructuredCompletion`);
  extend with a streaming chat call.

---

## 2. Frontend page hierarchy & navigation

```
/ai-chatbot                       Public product landing (marketing + pricing + how-it-works)
/chat/[chatbotId]                 Standalone hosted chat (iframe target, full-page)
/widget.js                        Served JS SDK (static asset / route handler)

(customer dashboard — behind auth)
/app/chatbots                     List, create, status toggle
/app/chatbots/[id]                Overview + analytics
/app/chatbots/[id]/settings       Appearance, domains, language, branding
/app/chatbots/[id]/knowledge      Sources, upload, crawl, re-index, search
/app/chatbots/[id]/prompt         System-prompt builder (versions, preview, restore)
/app/chatbots/[id]/model          Model picker (admin-allowed models only)
/app/chatbots/[id]/embed          JS snippet + iframe + domain allowlist
/app/chatbots/[id]/conversations  History, search, export, archive, leads
/app/api-keys                     Create/regenerate/revoke keys
/app/billing                      Plans, token packs, invoices, payment methods
/app/usage                        Charts: chats, tokens, latency, geography

(admin panel — extends existing /admin)
/admin/chatbots                   All tenants' bots, pause/disable
/admin/models                     Model catalog: costs, context, enable, plan assignment
/admin/plans                      Plans, token pricing, limits, coupons, taxes/GST
/admin/tenants                    Users: suspend, ban, grant bonus tokens, change plan
/admin/chat-usage                 Global usage, cost vs revenue, errors, queue health
```

Navigation, dark/light, skeletons, charts, search, pagination, filtering and
bulk actions follow the existing admin shell components (`src/components/admin/*`).

---

## 3. Backend folder structure

```
src/lib/server/chatbot/
  repository.ts        CRUD for chatbots (tenant-scoped)
  widget-config.ts     Resolve appearance/theme for the widget
  domains.ts           Allowlist match incl. wildcard (*.company.com)
src/lib/server/knowledge/
  repository.ts        Sources, files, chunks
  ingest.ts            Extract text (pdf/docx/txt/csv/md/html/json)
  crawl.ts             SSRF-safe crawler + sitemap import (reuse safe-url.ts)
  chunk.ts             Token-aware chunking with overlap
  embed.ts             Batch embeddings via provider
  search.ts            Vector search (Atlas $vectorSearch) + rerank
src/lib/server/chat/
  gateway.ts           Public chat entry: auth, rate limit, domain check
  rag.ts               Retrieve → build context → prompt → stream
  stream.ts            SSE/token streaming helpers
  conversations.ts     Persist messages, leads, feedback
src/lib/server/models/
  catalog.ts           Admin model catalog + per-plan visibility
  pricing.ts           Cost per input/output token, margin multiplier
src/lib/server/tokens-ledger/
  ledger.ts            Append-only token accounting (purchase/deduct/refund/bonus)
  balance.ts           Fast remaining-balance read (cached)
src/lib/server/billing/
  plans.ts  checkout.ts  webhooks.ts  invoices.ts  coupons.ts
src/lib/server/apikeys/
  repository.ts        Hashed keys, scopes, domain binding
src/app/api/v1/                    Public REST API (versioned)
src/app/chat/[chatbotId]/          Hosted chat page (iframe)
src/app/widget.js/route.ts         SDK loader
```

Everything is a thin module with a single responsibility, imported lazily by
route handlers and job handlers (matching the existing handler-registry style).

---

## 4. Database schema (ERD-level)

Collections (MongoDB), all timestamped, all tenant-scoped by `ownerId`:

- **chatbots** — `_id, ownerId, name, description, status(active|paused),
  websiteName, allowedDomains[], appearance{theme,avatar,logo,primaryColor,
  secondaryColor,position,size,welcome,placeholder,typing,branding,language,
  timezone,suggestedQuestions[],starterPrompts[]}, modelId, systemPromptId,
  publicTokenHash`. Index: `{ownerId,createdAt}`, unique `{publicTokenHash}`.
- **api_keys** — `_id, ownerId, name, keyHash, prefix, scopes[], allowedDomains[],
  lastUsedAt, expiresAt, status`. Only the hash is stored; the secret is shown once.
- **knowledge_sources** — `_id, ownerId, chatbotId, type(file|url|sitemap|manual|faq),
  origin, status(queued|processing|indexed|failed), bytes, chunkCount, error`.
- **knowledge_files** — binary/text ref (GridFS or object storage key).
- **knowledge_chunks** — `_id, ownerId, chatbotId, sourceId, ord, text,
  tokenCount, embedding[float], meta{title,url}`. **Atlas Vector Search index**
  on `embedding` (cosine), filter fields `ownerId, chatbotId`.
- **conversations** — `_id, chatbotId, ownerId, visitorHash, channel,
  country, device, browser, referrer, leadId, startedAt, lastMessageAt`.
- **messages** — `_id, conversationId, role, content, modelId, inputTokens,
  outputTokens, latencyMs, citations[], createdAt`.
- **models** — `_id, key, label, provider, baseUrl, inCostPerMTok, outCostPerMTok,
  maxContext, maxOutput, tempMin, tempMax, enabled, planIds[], isDefault`.
- **plans** — `_id, name, cadence(monthly|yearly|lifetime|payg), price, currency,
  monthlyTokens, chatbotLimit, knowledgeLimitMB, apiRateLimit, modelIds[],
  supportLevel, trialDays`.
- **subscriptions** — `_id, ownerId, planId, status, currentPeriodEnd,
  gatewayRef, cancelAtPeriodEnd`.
- **token_ledger** — append-only: `_id, ownerId, delta(+/-), kind(purchase|deduct|
  bonus|refund|expiry), balanceAfter, chatbotId?, messageId?, expiresAt?, createdAt`.
  Balance = latest `balanceAfter`; never mutate rows (auditable accounting).
- **payments / invoices / coupons** — gateway refs, line items, tax/GST, currency.
- **system_prompts** — `_id, ownerId, chatbotId, version, content, variables{},
  createdBy, createdAt` (immutable versions; chatbot points at active version).
- **widget_configs** — denormalised, public-safe appearance cache for the widget.
- **usage_daily** — pre-aggregated rollups per `ownerId/chatbotId/date` for charts.
- **audit_logs** — reuse existing `audit_log`.

Relationships: `user 1─* chatbots 1─* {knowledge_sources, api_keys(shared),
conversations, system_prompts}`; `chatbot *─1 model`; `user 1─* token_ledger`;
`user 1─1 subscription`.

---

## 5. REST API (versioned `/api/v1`)

Auth: management endpoints use the customer session/JWT; the chat endpoint uses
the chatbot **public token** + `Origin` allowlist; server-to-server uses an
**API key** (`Authorization: Bearer sk_live_…`).

```
POST /api/v1/chat
  headers: Origin: https://client.com
  body: { chatbotId, publicToken, conversationId?, message, stream?:true }
  200 (SSE): event:token data:{"delta":"..."}  … event:done data:{citations,usage}
  402 if out of tokens · 403 if domain not allowed · 429 if rate-limited

POST   /api/v1/chatbots            create           GET /api/v1/chatbots      list
GET/PATCH/DELETE /api/v1/chatbots/:id
POST   /api/v1/chatbots/:id/knowledge   {type,origin|file}  → 202 {sourceId,status:queued}
GET    /api/v1/chatbots/:id/knowledge    list + indexing progress
POST   /api/v1/chatbots/:id/reindex
GET/PUT /api/v1/chatbots/:id/prompt      versions; PUT creates new version
POST   /api/v1/chatbots/:id/prompt/restore {version}
GET    /api/v1/chatbots/:id/embed        → {scriptSnippet, iframeSnippet}
GET    /api/v1/conversations?chatbotId=  search/filter/paginate; ?export=csv
POST   /api/v1/api-keys   GET /api/v1/api-keys   POST /api/v1/api-keys/:id/regenerate
GET    /api/v1/tokens/balance            {remaining, expiringSoon}
POST   /api/v1/billing/checkout {planId|tokenPackId} → gateway session url
POST   /api/v1/billing/webhook           (gateway → us; signature-verified)
GET    /api/v1/analytics?chatbotId&range → charts payload
GET    /api/v1/models                    models visible to this tenant
(admin) /api/v1/admin/*                  models, plans, tenants, usage
```

Every response: `{ ok, data | error:{code,message} }`; validation with Zod at
the boundary (matching existing action patterns).

---

## 6. Authentication & authorization

- **Customers/admin** reuse the existing session system (opaque hashed tokens,
  `sessionEpoch`, roles). Optional JWT + refresh tokens for the SPA/API is a thin
  addition: short-lived access JWT signed with `AUTH_SECRET`, refresh token stored
  hashed server-side (revocable), Google OAuth optional.
- **Widget (public)** — a per-chatbot public token (safe to expose) that grants
  *chat only*, validated together with the request `Origin` against the domain
  allowlist. Never accepts management scope.
- **API keys** — `sk_live_<random>`; stored as a hash + short prefix for display;
  scoped permissions and optional domain binding; `lastUsedAt` tracked.
- **Authorization** — capability checks (reuse `assertCapability`/`roles.ts`) on
  every management action; row scoping by `ownerId` on every query. Admin
  override capabilities gate the admin endpoints.

---

## 7. Token accounting & deduction

- **Append-only ledger** (`token_ledger`). Balance is the last row's
  `balanceAfter`; reads are cached in Redis/settings cache and recomputed on write.
- **Per request:** estimate max cost pre-flight → **reserve** (write a pending
  deduct) → run the model → **reconcile** to actual `inputTokens+outputTokens`
  priced by the model's `inCostPerMTok/outCostPerMTok` × margin. A conditional
  update (`balanceAfter >= 0`) makes deduction atomic and race-safe under
  concurrency (same technique as the rate limiter's window doc).
- **402** returned to the widget when the reserve would go negative; the owner is
  emailed a "tokens low" notice at a configurable threshold.
- **Expiry** — purchased packs carry `expiresAt`; a daily job writes `kind:expiry`
  rows. Bonus/refund are ordinary signed rows, fully auditable.

---

## 8. Billing & subscription workflows

- Plans: monthly / yearly / lifetime / pay-as-you-go; each grants monthly token
  credits, model access, chatbot/knowledge/API limits, support level, trial days.
- **Checkout** → gateway session (Razorpay for INR/GST-native, or Stripe) →
  redirect → **webhook** (signature-verified) credits tokens / activates
  subscription and writes an invoice with tax/GST + currency.
- Renewals: a daily job grants monthly token credits on `currentPeriodEnd`
  rollover; failed payments dun and notify; coupons/discounts apply at checkout.
- All money events are idempotent on the gateway event id (dedupe like job
  `idempotencyKey`).

---

## 9. Embeddable widget (JS SDK + iframe)

- **`widget.js`** — a tiny (<15 KB gz) vanilla loader: reads `data-chatbot` /
  `data-token`, injects a Shadow-DOM host (style isolation from the host page),
  fetches `widget_configs` for appearance, opens the chat over SSE. Supports
  floating bubble / popup / fullscreen / embedded, desktop/tablet/mobile, dark/
  light, sound, unread badge, typing animation, suggested questions.
- **iframe** — `/chat/[chatbotId]` full-page hosted chat for zero-JS embeds.
- **Security** — the widget only holds the public token; every call re-checks the
  `Origin` allowlist server-side (client checks are cosmetic). CSP-friendly;
  no third-party requests from the host page beyond our origin.

---

## 10. RAG pipeline

**Ingestion (jobs queue):** upload/crawl → extract text (type-specific parser) →
normalise → **token-aware chunk** (≈500–800 tokens, ~15% overlap, heading-aware)
→ **embed in batches** → store `knowledge_chunks` with the Atlas Vector index.
Progress (`queued→processing→indexed`) is polled by the UI, same pattern as the
prospect-discovery console.

**Query time:** embed the question → `$vectorSearch` filtered by
`ownerId+chatbotId` (top-k) → optional rerank → build context within the model's
`maxContext` → compose system prompt (with `{{variables}}`) + context + history →
**stream** the answer → attach citations → persist message + token usage. If no
chunk clears a similarity threshold, return the configured fallback (hand-off,
lead capture, or "I don't know" — never a hallucinated answer).

---

## 11. Security best practices & threat model

- Transport: HTTPS only; HSTS. Secrets via env/secret manager, never in code
  (existing `env.ts` narrow-reader pattern).
- Input: Zod validation everywhere; the crawler reuses the **SSRF allowlist**
  (`safe-url.ts`) — critical, since KB URLs are attacker-influenced.
- Output: no raw HTML from untrusted content; widget runs in Shadow DOM; strict
  CSP; escape everything rendered.
- AuthZ: row scoping by `ownerId`; capability checks; public token grants chat
  only; API keys hashed + scoped + domain-bound.
- Abuse: per-chatbot and per-IP rate limits (Mongo/Redis), bot detection on the
  widget endpoint, domain allowlist, global spend cap per tenant (the token
  ledger *is* the DDoS/cost circuit-breaker — a drained balance stops spend).
- Injection defence: prompt-injection isolation — retrieved content and user
  input are clearly delimited as untrusted data in the prompt; tools (if any) are
  least-privilege. SQL/NoSQL injection N/A with the typed driver + no string
  queries. CSRF handled by same-site + server-action origin checks.
- Audit: every management + admin action written to `audit_log`.

**Top threats → mitigations:** token-drain abuse → reserve/deduct + caps;
cross-tenant read → mandatory `ownerId` filter + tests; SSRF via crawl → allowlist;
prompt injection → delimited untrusted context + no destructive tools; key leak →
hashed storage, rotation, domain binding; webhook forgery → signature verify.

---

## 12. Scalability & deployment

- MVP on the existing Next.js deployment (Vercel) + MongoDB Atlas + a managed
  Redis (Upstash) for cache/queue/rate-limit.
- Hot paths scale independently: the **chat gateway** is stateless and streams —
  horizontally scalable behind the CDN; **ingestion/embedding** run as queue
  workers that scale by concurrency. Docker images for both; Kubernetes-ready
  (HPA on CPU/queue-depth) when volume warrants moving off serverless.
- Atlas Vector Search for embeddings (no separate vector DB to operate at MVP);
  swap to a dedicated vector store (pgvector/Qdrant) only if scale demands.
- CDN for `widget.js` and static assets; gzip/brotli; SSE for streaming;
  WebSocket upgrade path for live agent hand-off. Target 10k+ concurrent chat
  sessions via stateless gateway + connection offload to the CDN edge.

---

## 13. Logging, monitoring, analytics, audit

- Structured logs per request (tenant, chatbot, latency, tokens, model, outcome).
- Metrics: error rate, p50/p95 latency, queue depth, embedding backlog, LLM spend
  vs revenue, payment failures, active sessions. Alert thresholds → email/webhook.
- Analytics: `usage_daily` rollups power the dashboard charts (chats, tokens,
  geography, devices, popular questions, satisfaction) without scanning raw
  messages. Audit log for every privileged action.

---

## 14. Technology stack & why

- **Next.js (App Router) + TypeScript** — already the app; one deploy, shared auth.
- **MongoDB Atlas + Atlas Vector Search** — already the datastore; native vector
  search avoids operating a second DB at MVP; row-level multi-tenancy.
- **Redis (Upstash)** — cache, distributed rate limits, queue backpressure.
- **OpenAI-compatible provider layer** — reuse `ai-provider.ts`; model-agnostic
  (OpenRouter today → GPT/Claude/Gemini/DeepSeek/Qwen/Kimi/custom) so the admin
  catalog controls availability without code changes.
- **SSE for streaming** — simpler and CDN-friendly vs WebSockets for one-way token
  streams; WS reserved for live hand-off.
- **Razorpay or Stripe** — Razorpay is GST/INR-native; Stripe for global cards.
- **Shadow DOM widget** — style isolation on any host site with a tiny footprint.

---

## 15. Roadmap: MVP → enterprise

1. **MVP (chat that works):** chatbot CRUD, manual + file KB, chunk/embed via
   jobs, Atlas vector search, single admin-set model, SSE chat, `widget.js` +
   iframe, domain allowlist, public token, token ledger + deduction, basic usage.
2. **Monetise:** plans + token packs, checkout + webhook + invoices (GST),
   subscription grants, "tokens low" emails, per-tenant limits.
3. **Depth:** system-prompt builder (versions/restore), website crawl + sitemap,
   model catalog + per-plan visibility, conversation history/search/export, lead
   capture, analytics charts.
4. **Integrations & hand-off:** webhooks, Zapier/Make, Slack/Teams/Discord, CRM,
   Google Sheets, human hand-off / ticketing.
5. **Scale & enterprise:** Redis queue + horizontal workers, Docker/K8s, rerank,
   multi-region, SSO, audit exports, SLA monitoring, dedicated vector store if
   needed.

---

### How it is sold (ready-to-use product)

Positioned on `/ai-chatbot`: pick a plan or token pack → create a bot → add
knowledge (upload or paste a URL) → write the system prompt → copy one line of
code → it is live. Token-metered so cost scales with usage; the same platform
powers Bitecodes' own site chat, so it is dogfooded before it is sold.
