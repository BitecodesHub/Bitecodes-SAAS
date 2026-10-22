# Bitecodes

The Bitecodes website and SaaS: marketing pages, service and industry content, the AI chatbot / forms / booking products, customer and admin portals, first-party analytics, and the autonomous growth engine that discovers prospects, audits their sites, drafts outreach, and reports on the pipeline.

## Stack

- **Next.js 16** App Router (React 19, TypeScript 6, Node.js 20.19 or newer)
- **MongoDB 7** driver; indexes are declared in `src/lib/server/db/schema.ts` and ensured on first connection
- **Tailwind CSS 4**, Radix UI, `next-themes`
- **Vitest 4** with integration suites that require a disposable MongoDB
- **pnpm 9.15.9** (the pinned package manager)

> This repository pins a version of Next.js whose conventions differ from older releases. Before changing framework behavior, read the relevant guide under `node_modules/next/dist/docs/` rather than relying on memory.

## Quick start

```bash
pnpm install
cp .env.example .env.local
```

Set the two required values in `.env.local`:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=bitecodes
```

`AUTH_SECRET` is needed as soon as you want to sign in. Generate one with `openssl rand -base64 32` and add it to `.env.local`; the app refuses to issue sessions without a secret of at least 32 characters.

Then:

```bash
pnpm dev
```

Open `http://localhost:3000`. Create the first staff account through the CLI (passwords are generated and printed once):

```bash
pnpm admin create owner@example.com "Owner" owner
```

Sign in at `/admin`. There is no setup wizard: on the first server start, `src/instrumentation.ts` runs a background bootstrap that creates the settings document, four default discovery presets, outreach templates, the default email sequence, and chatbot models. It never overwrites edited values and never turns on automatic contact.

### What runs without optional credentials

A deployment with only MongoDB and `AUTH_SECRET` serves the public site, blog, sitemap, robots, feeds, first-party analytics, discovery through public OpenStreetMap data, enrichment, site audits, lead capture, and the admin panel. Everything else is reported as a named capability instead of failing boot:

| Capability | Without credentials |
| --- | --- |
| Transactional email | `disabled` — no mail is queued or sent |
| Commercial sending | Outbound gate `closed` — nothing leaves, even if a toggle is on |
| AI drafting and summaries | `degraded` — AI steps are skipped; discovery and audits continue |
| Online payments | `manual` — orders are reserved and credits are granted by an owner |
| Reply detection | `manual` — sequences do not stop automatically on reply |
| Search pings | `disabled` — sitemap and metadata still work |

`GET /api/health` lists every capability and its state. The authenticated deep response adds the exact remedy for each one. Add keys as each capability is needed; see [`docs/operations/ENVIRONMENT_SECURITY_PRIVACY.md`](docs/operations/ENVIRONMENT_SECURITY_PRIVACY.md) for the full variable matrix.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm verify` | Lint, typecheck, format check, unit/integration tests, and build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript (native preview compiler) |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm test` / `pnpm test:watch` | Vitest, once / watch |
| `pnpm admin <command>` | Staff account management (see `pnpm admin` for usage) |

Load environment files for the admin CLI automatically; it reads `.env.local` and `.env.development.local`.

## Tests

Unit tests need no services. Database integration suites are **skipped** unless `TEST_MONGODB_URI` points at a disposable database:

```bash
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 pnpm test
```

Never point `TEST_MONGODB_URI` at production or a shared development database: several suites clear their collections before each test. Use a local `mongod`, a dedicated CI service, or a throwaway cluster.

Two live suites are opt-in and never run in CI:

```bash
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 RUN_LIVE_OSM=1 \
  pnpm vitest run src/lib/server/prospecting/osm.live.test.ts
RUN_LIVE_EMAIL=1 pnpm vitest run src/lib/server/email/e2e-outreach.live.test.ts
```

## Health and automation endpoints

| Endpoint | Auth | Behavior |
| --- | --- | --- |
| `GET /api/health` | Public | Shallow status: DB ping, autonomy summary, capability states. HTTP 503 only when MongoDB is unreachable. |
| `GET /api/health?deep=1` | `Authorization: Bearer $CRON_SECRET` | Runs live provider checks. 503 only when overall status is `fail`. |
| `POST /api/health/bootstrap` | Bearer `CRON_SECRET` | Re-runs the bootstrap. Body `{"dryRun":true}` writes nothing. |
| `POST /api/cron/run` (also GET) | Bearer `CRON_SECRET` | Enqueues due automations and drains the job queue. Driven by `.github/workflows/heartbeat.yml`; `vercel.json` adds one daily Vercel Cron tick as a floor when GitHub's scheduler is delayed. |
| `GET /api/warm` | Public | Warms the serverless instance and database pool; not a health check. |

The growth page at `/admin/growth` also has **Dry run** and **Reconcile now** controls, with the same result report, and the admin health panel surfaces bootstrap, schedule, preset, and outbound-gate checks.

Automation defaults are conservative: discovery always runs, auto-contact is off, commercial email waits for approval, and toggles that email prospects or customers are off until an owner enables them. No automation sends through a closed gate.

## Deployment

1. Set `MONGODB_URI`, `MONGODB_DB_NAME`, `AUTH_SECRET`, `SITE_URL`, and `CRON_SECRET` in the hosting secret store.
2. Set the same `CRON_SECRET` in the GitHub repository secrets so the heartbeat can call `/api/cron/run`. Vercel's daily cron fallback authenticates with the hosting `CRON_SECRET` automatically.
3. Deploy. The first boot creates the default records; verify `GET /api/health` and `POST /api/health/bootstrap` with `{"dryRun":true}`.
4. Configure optional providers from the admin panel (`/admin/desktop` for AI, `/admin/settings` and `/admin/growth` for email and automation) only after DNS, SPF/DKIM/DMARC, and the postal address are in place.
5. Complete [`docs/growth/OWNER_CHECKLIST.md`](docs/growth/OWNER_CHECKLIST.md) before enabling outbound marketing.

Operational procedures:

- [`docs/operations/ENVIRONMENT_SECURITY_PRIVACY.md`](docs/operations/ENVIRONMENT_SECURITY_PRIVACY.md) — profiles, every variable, secret handling, privacy and retention.
- [`docs/operations/RUNBOOKS.md`](docs/operations/RUNBOOKS.md) — widget rollback, provider outage, runaway job, accidental outbound batch, billing discrepancy, compromised key, database restore.
- [`upgrade-plan.md`](upgrade-plan.md) — task register, release gates, deferred findings.

## Repository notes

- Secrets belong in `.env.local`, `.env.development.local`, the hosting secret manager, or GitHub secrets. `.env.example` documents names and failure behavior only.
- `docs/leads/` must stay out of git; prospect lists are personal data. See the owner checklist.
- The growth engine's jobs are idempotent per time bucket and dead-letter after bounded attempts. Use `/admin/jobs` to retry or cancel; do not edit queue rows by hand.
