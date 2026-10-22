# Environment, Security, and Privacy Matrix

Status: **ready for deployment review and sign-off** · Owner: repository owner · Last reviewed: 2026-10-22 · Code baseline: `growth/customer-magnet`

This is the operational source of truth for what the deployment needs, what happens when a value is absent, which values are secrets, and which personal data the product stores. It is written to be read next to `.env.example`; if the two disagree, this document wins and `.env.example` should be corrected.

Related documents:

- [`RUNBOOKS.md`](./RUNBOOKS.md) — incident procedures.
- [`../growth/OWNER_CHECKLIST.md`](../growth/OWNER_CHECKLIST.md) — actions only the owner can take.
- [`/api/health`](../../src/app/api/health/route.ts) — live capability states; the authenticated deep response adds the exact remedy for each.

---

## 1. First-boot profiles

The application has one hard dependency and two recommended ones. Everything else degrades to a visible state instead of blocking startup.

| Profile | What is set | What works | What is explicitly held |
| --- | --- | --- | --- |
| **Bare / no optional credentials** | `MONGODB_URI`, `MONGODB_DB_NAME` | Public pages, blog, sitemap, robots, feeds, first-party analytics, prospect discovery through OpenStreetMap, enrichment, auditing, scoring, admin sign-in (with `AUTH_SECRET`) | AI drafting, transactional email, commercial sending, online checkout, search pings, reply detection |
| **Content and pipeline** | Above + `AUTH_SECRET`, `CRON_SECRET`, optionally `AI_API_KEY` | The above plus scheduled discovery, AI drafts into the approval queue, owner reports (email requires SMTP) | Commercial sending remains **closed** without SMTP, a sender address, and a postal address |
| **Commerce** | Above + SMTP, `OUTREACH_FROM`, `OUTREACH_POSTAL_ADDRESS`, domain authentication, optionally Razorpay | Enquiry mail, booking mail, approval queue, manual or live payments | Sending is **manual** while `automation.requireApproval` is on (the default) |
| **Fully autonomous sending** | All of the above + `requireApproval: false` + the specific growth toggles | Eligible automation may send within caps and consent rules | Regions requiring prior consent remain held unless the owner changes that guard |

`/api/health` (shallow) reports which profile the running deployment is in. It returns HTTP 503 only when MongoDB is unreachable; a missing optional provider is a named capability state, not an outage.

At server start, `src/instrumentation.ts` runs the bootstrap in the background. It creates the settings document, four default discovery presets, outreach templates, the default sequence, and chatbot models when the database is empty. It never overwrites an edited value and never enables automatic contact. A missing database does not prevent the server from booting; the failure appears in the log and in `/api/health`.

---

## 2. Environment matrix

Legend for **Failure behavior**: what the user or operator sees when the value is absent or invalid.

### 2.1 Boot and persistence

| Variable | Required | Secret class | Failure behavior | Notes |
| --- | --- | --- | --- | --- |
| `MONGODB_URI` | **Yes** | **Highest** (contains credentials) | Public static output may still render; every dynamic page and `/api/health` reports 503. | Atlas rejects unlisted egress IPs with a TLS handshake error that looks like a certificate problem. Add the deployment's egress IPs to the cluster access list. |
| `MONGODB_DB_NAME` | No (default `bitecodes`) | Config | Defaults to `bitecodes`. | Use a separate database per environment. |

### 2.2 Sessions, signed links, and the job runner

| Variable | Required | Secret class | Failure behavior | Notes |
| --- | --- | --- | --- | --- |
| `AUTH_SECRET` | Recommended; required for sign-in | **Highest** (≥32 chars) | Admin and customer sign-in, unsubscribe links, portal links, report links, and tracking tokens cannot be signed. Health reports `signed-links: disabled`. | `openssl rand -base64 32`. Rotating it invalidates every session and outstanding signed link. |
| `CRON_SECRET` | Recommended; required for automation | **Highest** (≥16 chars) | `/api/cron/run` and `/api/health/bootstrap` return 503 and refuse to run. No scheduled job runs. Health reports `scheduled-jobs: disabled`. | `openssl rand -hex 16`. Set the same value in the scheduler's secret store. |
| `SITE_URL` | No | Config | Defaults to `https://www.bitecodes.com` in production and `http://localhost:3000` elsewhere. | Must be the origin actually served (including `www`). Apex→www redirects break CORS preflight for the widget. |

### 2.3 Email

| Variable | Required | Secret class | Failure behavior | Notes |
| --- | --- | --- | --- | --- |
| `SMTP_HOST` | For email | Config | No transactional or commercial email. Health `SMTP: not-configured`; capability `transactional-email: disabled`. | |
| `SMTP_PORT` | For email | Config | Email cannot connect. | 465 normally pairs with `SMTP_SECURE=true`; 587 with `false`. |
| `SMTP_SECURE` | For email | Config | Email cannot connect. | `"true"` / `"false"`. |
| `SMTP_USER` | For email | Secret (identity) | Authentication fails. | |
| `SMTP_PASSWORD` | For email | **Highest** | Authentication fails. | Prefer an app-specific password, not the mailbox password. |
| `SMTP_FROM` | For email | Config | Email cannot be composed. | Display name plus address. |
| `CONTACT_NOTIFICATION_TO` | For email | PII (recipient addresses) | Owner notifications are skipped; enquiry capture still stores the lead. | Comma-separated. Also editable per notification channel in settings. |
| `OUTREACH_FROM` | For commercial email | Config | Outbound gate stays **closed**; nothing commercial sends. | Use a subdomain with its own SPF/DKIM/DMARC, separate from transactional mail. |
| `OUTREACH_REPLY_TO` | No | Config | Replies go to `OUTREACH_FROM`. | |
| `OUTREACH_POSTAL_ADDRESS` | For commercial email | PII (business address) | Outbound gate stays **closed**. | Legally required in commercial email footers (CAN-SPAM and equivalents). Can also be set in Settings → Contact. |
| `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD` | No | Host/user config; password **Highest** | Reply detection is `manual`: sequences do not stop automatically on reply. | `IMAP_PORT` defaults to 993. |

### 2.4 AI

| Variable | Required | Secret class | Failure behavior | Notes |
| --- | --- | --- | --- | --- |
| `AI_API_KEY` (or legacy `OPENROUTER_API_KEY`) | No | **Highest** | AI steps are skipped; discovery, enrichment, audits, scoring, and public pages continue. Drafting and chat report `degraded`. | Provider keys configured under `/admin/desktop` take precedence for background automations; this is the platform fallback. |
| `AI_BASE_URL` | No | Config | Defaults to OpenRouter. | Must include `/v1`. Only NVIDIA, OpenRouter, and Groq hosts are accepted for background automation fallback; other hosts serve only the site chat and consultant. |
| `AI_MODEL` (or `OPENROUTER_MODEL`) | No | Config | Defaults to `google/gemini-2.5-flash`. | Must support JSON Schema structured outputs. |
| `AI_TIMEOUT_MS` | No | Config | Defaults to 25 s, capped at 300 s. | Shared community endpoints may queue for minutes. |

### 2.5 Discovery

| Variable | Required | Secret class | Failure behavior | Notes |
| --- | --- | --- | --- | --- |
| `OVERPASS_ENDPOINT` | No | Config | Defaults to the public Overpass instance. | Donated infrastructure. The client throttles and caches; do not remove those limits. |
| `NOMINATIM_ENDPOINT` | No | Config | Defaults to the public Nominatim instance. | Same shared-service constraints. |
| `GOOGLE_PLACES_API_KEY` | No | **Highest** | Google Places is unavailable; OpenStreetMap remains the provider. | Google's terms restrict caching beyond `place_id` and prohibit building a prospect database, which this feature does. Leave unset unless those terms have been accepted. |

### 2.6 SEO

| Variable | Required | Secret class | Failure behavior | Notes |
| --- | --- | --- | --- | --- |
| `INDEXNOW_KEY` | No | Public by design (served at `/<key>.txt`) | Search pings are `disabled`; sitemap and canonical metadata still work. Health records the retry state. | 8–128 chars of `[A-Za-z0-9-]`. A ping never implies indexing. |
| `GOOGLE_SITE_VERIFICATION` | No | Public token | No verification meta tag. | Token only, not the whole tag. |
| `BING_SITE_VERIFICATION` | No | Public token | No verification meta tag. | Token only. |

### 2.7 Billing

| Variable | Required | Secret class | Failure behavior | Notes |
| --- | --- | --- | --- | --- |
| `RAZORPAY_KEY_ID` | No | Identifier | Checkout falls back to the manual provider: the order is reserved and tracked, and an owner grants credits after direct payment. Health reports `payments: manual`. | |
| `RAZORPAY_KEY_SECRET` | No | **Highest** | Same manual fallback. | |
| `RAZORPAY_WEBHOOK_SECRET` | No | **Highest** | Same manual fallback. The webhook route rejects unsigned or mismatched payloads. | Configure the webhook at `/api/billing/webhook` for `payment.captured`. |

### 2.8 Sign-in and booking

| Variable | Required | Secret class | Failure behavior | Notes |
| --- | --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` | No | Identifier | "Continue with Google" is hidden. | Google sign-in creates customer accounts only; staff use password + TOTP. |
| `GOOGLE_CLIENT_SECRET` | No | **Highest** | Same. | Register the exact callback URLs, including `www`. |
| `BITECODES_DISCOVERY_BOOKING_ID` | No | Config | `/book-a-call` links fall back to `/contact?intent=call`. | |

### 2.9 Tests only

| Variable | Purpose | Notes |
| --- | --- | --- |
| `TEST_MONGODB_URI` | Enables database integration suites | When absent, those suites are **SKIPPED** with a warning, never silently passed. |
| `RUN_LIVE_OSM=1` | Opts into the live Overpass test | Never set in CI. |
| `RUN_LIVE_EMAIL=1` | Opts into the live email end-to-end test | Never set in CI. |

### 2.10 Not used

`CHAT_SUMMARIES_ENABLED` appears in `.env.example` but no code reads it. Chat summaries are controlled by the `chatSummaries` growth toggle. Remove the variable or treat it as documentation only; it does not change behavior.

---

## 3. Secret handling rules

1. **Never commit secrets.** `.env.local` and `.env.development.local` are ignored; `.env.example` contains names and comments only.
2. **Never paste production values into chat, tickets, or logs.** The application redacts credential-like keys in audit details and never returns secret values from health endpoints.
3. **Separate classes.** SMTP, outreach, AI, payment, OAuth, IMAP, and database credentials should be different credentials with different rotation schedules.
4. **Least privilege.** The database user needs read/write on one database, not cluster admin. The SMTP user should be limited to the sending domain. The Razorpay webhook secret is separate from the API secret.
5. **Rotation.** Rotating `AUTH_SECRET` invalidates all sessions and signed links; do it during a maintenance window. Rotating `CRON_SECRET` requires updating the scheduler in the same change. Rotating SMTP/AI/payment keys takes effect on the next process start unless the provider client caches; restart to be certain.
6. **Exposure response.** If a key was committed, revoke it at the provider first, then rewrite history and redeploy. Removing the file in a later commit is not enough.

---

## 4. Security controls in the codebase

| Control | Where | Notes |
| --- | --- | --- |
| Session signing | `AUTH_SECRET`; `src/lib/server/auth/` | HMAC-signed sessions. Staff and customers are separate account types. |
| Password + TOTP for staff | `src/lib/server/auth/totp.ts` | Google sign-in deliberately cannot authenticate staff who have TOTP enabled. |
| Capability checks | `src/lib/server/auth/dal.ts` | Every admin page and server action asserts a capability; the UI is not the security boundary. |
| Server Actions | `src/lib/server/**/actions.ts` | State-changing operations are server-side; inputs are validated with zod. |
| Signed, single-use links | unsubscribe, portal, reports, tracking | Tokens are signed and scoped; no sequential identifiers. |
| Webhook verification | `src/lib/server/billing/webhook.ts` | Razorpay signatures are verified; duplicate deliveries are idempotent through a unique event key. |
| Outbound compliance gate | `src/lib/server/email/compliance.ts`, `send.ts` | Suppression, deliverability, caps, consent regions, postal address, unsubscribe URL, and approval are evaluated before a commercial message is persisted for sending. |
| Send idempotency | `claimProspectFirstContact`, job idempotency keys | A retry cannot double-send. |
| Widget origin allowlist | chatbot/widget configuration and `widget-origin` tests | Embeds are restricted to configured origins; CORS preflight is handled explicitly. |
| Security headers | `next.config.ts` | `nosniff`, HSTS, referrer policy, permissions policy, frame guard with documented embed exemptions, `X-Robots-Tag` for private routes and health endpoints. |
| Rate limiting | Mongo-backed counters with TTL | Login, enquiry, chat, and public endpoints use bounded counters. |
| Audit log | `src/lib/server/audit-log.ts` | Security-relevant actions record actor, target, and redacted detail. |
| Least-data analytics | `src/lib/server/analytics/` | No cookies or pixels; daily-salted visitor hash; raw IP/UA/query strings are not stored; DNT/GPC honored. |

Known limitations, recorded rather than hidden:

- There is no strict Content-Security-Policy. The current header set improves baseline posture but does not prevent every injected script; a CSP should be introduced with a report-only rollout.
- The callback calling agent toggle exists, but no telephony provider is integrated in this repository. No call can be placed; leave the switch off.
- Chat transcripts have no automatic retention. See §5 and the deferred findings in `upgrade-plan.md`.

---

## 5. Privacy and data-flow matrix

| Data | Collection / location | Why it is stored | Personal data | Retention | Who can read it |
| --- | --- | --- | --- | --- | --- |
| Contact enquiries | `contact_enquiries` | Respond to a sales enquiry; CRM | Name, email, company, role, budget, message | Until the enquiry is resolved and deleted by an owner; no automatic expiry | Admin roles with lead access |
| Newsletter subscribers | `newsletter_subscribers` | Send consented updates | Email, status, timestamps | Until unsubscribe + manual deletion; suppression is retained | Admin roles with marketing access |
| Website analytics events | `analytics_events` | Page views, events, web vitals | Daily-salted visitor hash only; no raw IP, UA, full referrer, or query string | **180 days** (TTL); daily aggregates contain no visitor identifier and are kept for reporting | Admin analytics |
| Prospects (outreach) | `prospects`, `prospect_searches` | B2B prospecting | Business name, public address, public contact details, website signals, derived score | Until deleted by an owner; no automatic expiry | Admin roles with prospecting access |
| Outreach email | `email_messages`, `sequence_enrollments` | Deliver and audit commercial email; stop on reply | Recipient address, message content, timestamps, tracking events | Until deleted by an owner; suppressions retained permanently | Admin roles with email access |
| Suppression list | `suppressions` | Honour opt-outs and bounces | Email/domain | Retained indefinitely; removing it would re-contact someone who opted out | Admin email roles |
| Chat conversations | `chat_conversations` | Answer visitors and review unanswered questions | Conversation text, page context, optional contact details | **No automatic expiry**; an owner can delete. This is a known gap; do not promise a retention period until a TTL is added. | Admin roles with chat access |
| Desktop prompts and answers | `desktop_prompt_log` | Provide the desktop assistant and per-user history | Prompt text, answer text, timestamps, app/OS version, token counts, one-way IP hash | **180 days** (`expiresAt` TTL) | Account owner; admin with desktop access for support |
| Desktop sign-in activity | `desktop_events` | Device security and revocation | Event type, device metadata, hashed IP | **180 days** (TTL) | Account owner; admin support |
| AI automation runs | `ai_automation_runs` | Debug automation failures and cost | Prompt purpose, provider, model, token counts, error codes | **90 days** (TTL) | Admin growth |
| Search submissions | `search_submissions` | Retry IndexNow pings and report state | URL path, state, timestamps | **90 days** after last attempt (TTL) | Admin SEO |
| Billing orders and ledger | `billing_orders`, `billing_events`, `wallet_ledger` | Provide prepaid credits and reconcile payments | Account id, amount, provider ids, event payload | Financial record; retained until the owner's accounting policy allows deletion | Admin billing/owners |
| Audit log | `audit_log` | Security and accountability | Actor id/email, action, target, redacted detail, hashed IP | Until deleted by an owner; no automatic expiry | Owners/admins |
| Server logs | Hosting provider | Operate and debug | Request metadata, errors | Per hosting provider's retention policy | Hosting provider; operator |

### Data leaving the deployment

| Recipient | Data | Purpose | Control |
| --- | --- | --- | --- |
| MongoDB Atlas (or self-hosted MongoDB) | Everything in §5 | Primary persistence | Encryption in transit; database access list; separate database per environment |
| SMTP provider | Recipient, subject, body, attachments | Deliver email | SPF/DKIM/DMARC; suppression and compliance gates before queueing |
| AI providers (OpenRouter, NVIDIA, Groq, Bedrock, or configured provider) | Prompts, answers, screenshots, prospect research inputs | Produce answers, drafts, summaries | Provider choice and keys under `/admin/desktop`; providers are asked not to retain or train where that option exists; desktop screenshots are not stored by this application |
| Razorpay | Name/email for checkout, order amount, payment status | Take payment and reconcile | Only when configured; the webhook signature is verified |
| Google | OAuth identity for customer sign-in | Sign in | Only when configured; staff cannot use it to bypass TOTP |
| OpenStreetMap Overpass / Nominatim | Area bounding boxes and category filters | Discover public businesses | No prospect personal data is sent; results are stored with ODbL attribution |
| IndexNow (Bing/Yandex) | Changed URLs only | Notify search engines | No personal data |
| Hosting platform | Request metadata and application logs | Serve the site | Platform access controls |

### Subject rights procedure

1. Identify the person by email or account id. Do not use fuzzy name matching.
2. Export: enquiry/CRM records, chat transcripts, desktop prompt log, email messages, billing records, and referral records that match. Provide a machine-readable export.
3. Erase: delete the rows, add the address to `suppressions` so it is not re-contacted, and record the request in the audit log **without** copying the personal data into the audit detail. Retain only what accounting or legal obligations require, and say so in the response.
4. Deadline: follow the applicable regime (GDPR one month; other regimes as applicable). The procedure is manual; there is no self-service export/delete endpoint.

---

## 6. Deployment sign-off checklist

Complete this before exposing a production deployment.

- [ ] `MONGODB_URI` points at the production database, the egress IP is on the Atlas access list, and the database user is scoped to that database.
- [ ] `AUTH_SECRET` is ≥32 characters, unique to this environment, and stored in the hosting secret manager.
- [ ] `CRON_SECRET` is ≥16 characters, set in both the hosting environment and the scheduler's secret store; `/api/cron/run` returns 200 with a bearer token and 401 without.
- [ ] `SITE_URL` is the served origin, including `www` if that is canonical.
- [ ] SPF, DKIM, and DMARC are published for the transactional sending domain.
- [ ] SPF, DKIM, and DMARC are published for the outreach subdomain (ideally separate from transactional mail).
- [ ] `OUTREACH_FROM`, `OUTREACH_REPLY_TO`, and a postal address are set; the postal address also appears in Settings → Contact.
- [ ] `automation.requireApproval` is on, `autopilot` is off, and external-email growth toggles are off until the first batch is reviewed.
- [ ] `blockConsentRequiredRegions` is on unless a legal basis for each region has been documented.
- [ ] Razorpay keys are test keys or live keys as intended; the webhook points at `/api/billing/webhook` and a test event is recorded in `billing_events`.
- [ ] Google OAuth callbacks are registered exactly, including `www` and localhost for development.
- [ ] `INDEXNOW_KEY` is set if pings are wanted; Google and Bing verification tokens are set and the sitemap is submitted.
- [ ] `GET /api/health` returns 200 and lists the expected capability states.
- [ ] `GET /api/health?deep=1` with the bearer token returns 200 or an expected degradation, with no secret values.
- [ ] `POST /api/health/bootstrap` with `{"dryRun":true}` reports no unexpected missing records.
- [ ] The first live bootstrap has run (restart or `{"dryRun":false}`); the admin Growth page shows the bootstrap panel.
- [ ] Privacy policy reflects the actual providers in use and the retention table above.
- [ ] A restore from backup has been tested at least once (see `RUNBOOKS.md` §7).

Sign-off:

| Role | Name | Date | Notes |
| --- | --- | --- | --- |
| Repository owner | | | |
| Deployment operator | | | |
| Privacy/legal reviewer | | | |
