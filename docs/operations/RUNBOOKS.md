# Incident Runbooks

Status: **active** · Owner: repository owner · Last reviewed: 2026-10-22 · Code baseline: `growth/customer-magnet`

These are the procedures for the seven incidents named in the upgrade plan. Each one starts with containment, then diagnosis, then recovery, then the evidence to keep. Commands assume the production origin is `https://www.bitecodes.com`; substitute the actual `SITE_URL`.

Related documents:

- [`ENVIRONMENT_SECURITY_PRIVACY.md`](./ENVIRONMENT_SECURITY_PRIVACY.md) — variables, secret classes, privacy data flows.
- [`../growth/OWNER_CHECKLIST.md`](../growth/OWNER_CHECKLIST.md) — actions only the owner can take.
- `upgrade-plan.md` §14 — deferred findings and the rule that unverified work is not complete.

---

## 0. Before an incident: the control map

Bookmark these. Every switch below is already implemented; none requires a deploy.

| Risk | Control | Where | Effect |
| --- | --- | --- | --- |
| Widget misbehaving | Pause the chatbot | `/admin/chatbots` → toggle status | The widget's config lookup stops resolving (404, deliberately indistinguishable from a bad token) and the embed renders and answers nothing. Settings and knowledge are kept. |
| Auto-contact too aggressive | `automation.autopilot` | `/admin/settings` | Stops enrolling discovered prospects. Discovery presets and drafting continue. |
| Any commercial email leaving without review | `automation.requireApproval` | `/admin/settings` | Every commercial message stops in the approval queue. This is the default. |
| A specific automation sending email | Its toggle | `/admin/growth` | `winbackEmails`, `lifecycleEmails`, `monthlyCustomerReports`, `feedbackRequests`, and `bookingReminders` are the external-email switches. All but booking reminders default off. |
| A standing search running | Preset enabled switch | `/admin/customers/discover` | The preset stops being claimed. Pausing is preferred to deleting, because the next heartbeat restores the default list only when the whole list is empty. |
| A queued or running job | Cancel / Retry | `/admin/jobs` | Cancels before the next claim or retries a dead-lettered job after its cause is fixed. |
| All automation | Disable the heartbeat workflow **and** pause the Vercel daily cron | GitHub → Actions → **Heartbeat** → Disable workflow (`gh workflow disable heartbeat.yml`); Vercel → Project → Settings → Cron Jobs, or remove the `crons` entry from `vercel.json` and redeploy | No new cron tick, so no new jobs are enqueued or drained. The daily Vercel cron is a floor, not a duplicate: leaving it enabled means automation resumes within a day. Server-start bootstrap still runs on deploy. Re-enable both when safe. |
| AI steps only | `aiEnabled` | `/admin/growth` | Background automations skip every AI call. Discovery, enrichment, audits, and public pages continue. |

Owner/admin role notes: all toggles require `manage_settings`; job retry/cancel requires the capability asserted by the jobs page; sending requires `send_email`.

### Reading health

```bash
# Shallow: public, safe, no secrets. 503 only when MongoDB is unreachable.
curl -sS https://www.bitecodes.com/api/health | jq

# Deep: live provider probes. Requires CRON_SECRET as a bearer token.
# Export it from the secret store; never paste the literal value into a ticket.
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.bitecodes.com/api/health?deep=1" | jq
```

`bootstrap.ok=false`, a `fail` check, or an unexpected capability state is the starting point for every runbook below. The deep response includes the remedy for each capability, so record the exact `remedy` or `detail` string in the incident note.

> Secrets: never paste `MONGODB_URI`, SMTP passwords, provider keys, or `CRON_SECRET` into a ticket, chat, screenshot, or the audit log. Export them from the secret manager in the shell that needs them.

---

## 1. Widget rollback

**Trigger:** the embedded assistant answers incorrectly, leaks another tenant's content, breaks a customer's layout, or a newly deployed `widget.js` regresses.

**Contain first (seconds):**

1. Open `/admin/chatbots`, find the bot, set it to **paused**.
2. Confirm in the browser that the embed no longer mounts an interactive assistant. The script may still be present in the page source; pause is enforced server-side when the widget fetches `/config`.
3. If the problem affects every bot, pause every active bot. There is no global widget pause; pausing each bot is the supported rollback.

**If the cause is the deployed script, not a bot:**

1. Pause the affected bots first — a deployment rollback also reverts unrelated work.
2. Roll back the deployment in the hosting provider: Vercel → Project → Deployments → previous healthy deployment → **Promote to Production** (or the provider's equivalent). Record the deployment id before and after.
3. The loader is cached for five minutes in browsers and up to a day at the edge (`Cache-Control: public, max-age=300, s-maxage=86400`). After the rollback, purge the edge cache for `/widget.js` in the hosting provider, and tell affected customers a hard refresh may be needed.
4. Unpause each bot only after verifying the restored script.

**Verify:**

```bash
curl -sSI https://www.bitecodes.com/widget.js | grep -i "x-bitecodes-widget-version\|cache-control"
curl -sS https://www.bitecodes.com/api/health | jq '.capabilities[] | select(.id=="website-chat")'
```

Load a page that embeds the widget, open the browser console, and confirm `/config` returns 200 for an active bot and 404 for a paused one (the endpoint deliberately does not distinguish paused from missing). Check the bot's allowed domains have not changed.

**Evidence:** bot id, pause time (UTC), deployment ids, cache purge time, console/network results, and the customer message sent. `audit_log` records the chatbot status change.

**Do not:** delete the bot or its knowledge to "roll back"; pause preserves everything and is reversible. Do not edit the generated script in place; it is served from source.

---

## 2. Provider outage

Applies to the AI fallback chain, SMTP/IMAP, MongoDB, and the public OpenStreetMap services. Each degrades to a named capability state; none should crash the public site.

### 2.1 AI provider

**Symptoms:** drafts and summaries stop, `ai_automation_runs` records failures, health deep check reports a provider failure, jobs for AI steps retry then dead-letter.

**Contain:**

1. Check `/api/health?deep=1` for the provider probe and `/admin/desktop` for the 24-hour failure table.
2. If one provider is down and another has a key, open `/admin/desktop`, disable the failing provider, confirm the fallback order, and save. The next job attempt uses the remaining chain.
3. If no provider is healthy, switch `aiEnabled` off in `/admin/growth`. This stops AI steps from burning retries; discovery, enrichment, audits, and public pages continue. Leave it off until a provider is restored.
4. Do not delete `ai_automation_runs`; the TTL removes rows after 90 days.

**Recover:** restore the provider or add a key, verify with the deep health check, re-enable `aiEnabled`, then retry dead-lettered jobs from `/admin/jobs` one type at a time. A job that fails again should stay dead-lettered; investigate the payload rather than retrying repeatedly.

**Evidence:** provider name, first and last failure timestamps, HTTP status/error code from `ai_automation_runs`, jobs affected, and the fallback order in effect.

### 2.2 SMTP / IMAP

**Symptoms:** transactional mail and outreach jobs fail; `/api/health` shows `SMTP: not-configured` or a send failure; approval-queue mail is stuck; reply detection is `manual`.

**Contain:**

1. In `/admin/settings`, confirm `requireApproval` is on.
2. In `/admin/growth`, switch off the external-email toggles that are active.
3. In `/admin/customers/discover`, pause any preset that is generating outreach, or switch `autopilot` off.
4. Do not approve queued messages while the transport is broken; they will fail and consume attempts.

**Recover:** fix the SMTP host/port/credentials or app password in the hosting secret store, redeploy or restart so the transport is rebuilt, send a test only to the owner address, then re-enable one toggle at a time. Retry dead-lettered `email.send` jobs from `/admin/jobs`; confirm the message has not already been sent before retrying (the job idempotency key and `email_messages` status are the evidence).

If the mailbox is reachable but IMAP is not, reply detection stays `manual`: sequences will not stop automatically on reply. Check the mailbox manually until IMAP is restored, and stop affected enrollments if a reply has arrived.

**Evidence:** failed job ids and error text, message ids, whether any message left the provider, and the suppression/bounce list changes.

### 2.3 MongoDB

**Symptoms:** `/api/health` returns 503; dynamic pages and admin fail; the cron route cannot run.

**Contain:** do not restart repeatedly. Check the Atlas cluster status, the deployment's egress IP against the access list, and the database user. Atlas rejects unlisted egress with a TLS handshake error that resembles a certificate problem. If the database is down, public static pages may still render; outbound work cannot proceed, which is the safe state.

**Recover:** restore connectivity or the cluster, then verify `/api/health` 200, admin sign-in, and one dry-run bootstrap. If data was lost or corrupted, go to §7. If the connection string changed, update the hosting secret and redeploy.

**Evidence:** health response, Atlas incident/alert id, the exact driver error (redact credentials), and the time service returned to 200.

### 2.4 OpenStreetMap (Overpass / Nominatim)

**Symptoms:** discovery runs fail or time out; prospect counts stop growing; presets remain due.

**Contain:** no code action is required and none should be taken to bypass the client's throttle or cache. Public Overpass and Nominatim are donated infrastructure. If failures persist, pause affected presets in `/admin/customers/discover` so the same area is not retried every cadence.

**Recover:** wait for the service, or set `OVERPASS_ENDPOINT` / `NOMINATIM_ENDPOINT` to a compliant alternative and redeploy. Re-enable presets and run one manually; confirm the run appears in the preset's `lastRunAt` and Recent runs.

**Evidence:** endpoint, error, affected preset ids, and the first successful run after recovery.

---

## 3. Runaway job

**Trigger:** a job repeats, consumes budget, sends too much, or stays `running`/`failed` far beyond its normal duration.

**Contain, in this order:**

1. Open `/admin/jobs`. Filter `running` and `failed`. Cancel the specific job (Cancel works for `queued` and `running`; it marks the row cancelled and releases its lock).
2. If the job will be re-enqueued by its schedule, disable its owning switch first:
   - discovery/autopilot: `autopilot` off in `/admin/settings` and pause the preset;
   - AI drafts/research/scoring: the matching toggle in `/admin/growth`, or `aiEnabled` off for all AI steps;
   - external email: the matching toggle and `requireApproval` on;
   - sequence tick: there is no per-sequence pause UI; keep `requireApproval` on, cancel queued send jobs, and disable the heartbeat if the loop is still active.
3. If many jobs are queued and the runner keeps claiming them, disable the heartbeat workflow and pause the Vercel daily cron (`vercel.json`). Together they are the global stop; the daily cron alone resumes automation within a day. Re-enable both only after the queue and toggles are sane.
4. A job already inside a serverless invocation cannot be interrupted by Cancel; the handler checks its budget between items. Expect the current invocation to finish, and prevent the next claim.

**Diagnose:** job `type`, attempts, `lastError`, `lockedBy`, created/updated times; the owning handler's logs; queue counts from the cron response (`queued`, `running`, `failed`); `audit_log` for manual triggers. Jobs dead-letter after the bounded attempt count (five by default), so a poison job stops itself; repeated identical failures usually mean bad input or a provider contract change, not a transient error.

**Recover:** fix the cause, retry the dead-lettered job from `/admin/jobs`, and watch one full run. Re-enable the toggle and heartbeat last. If the job created side effects before failing, follow §4 or §5 as applicable.

**Evidence:** job ids, type, attempt counts, error text, queue counts before/after, toggle state, and the first successful run after recovery.

---

## 4. Accidental outbound batch

**Trigger:** mail left, or is about to leave, to the wrong list, the wrong template, or without review.

**Contain immediately (minutes matter):**

1. `/admin/settings` → turn **Hold outreach for approval** on.
2. `/admin/growth` → switch off every external-email toggle that is on: win-back, lifecycle, monthly reports, feedback requests, booking reminders.
3. `/admin/settings` → **Contact qualified customers automatically** off; `/admin/customers/discover` → pause presets if discovery is feeding the batch.
4. `/admin/email` → in **Awaiting your approval**, discard unsent messages. If messages were already approved and send jobs are queued, cancel those jobs in `/admin/jobs`.
5. If sends are still draining, disable the heartbeat workflow and pause the Vercel daily cron. Do not delete queue rows; cancel them so the record survives.
6. Once the send path is stopped, do not "send a correction" to the whole list without an owner decision. A second bulk message compounds the incident.

**Assess:**

```text
/admin/email                 sent/queued view and approval state
email_messages               recipient, template, status, sentAt, provider id
sequence_enrollments         who is enrolled, current step, stop reason
suppressions                 bounces, complaints, opt-outs already recorded
audit_log                    who approved or triggered the batch
```

Record the exact recipient count, time window (UTC), template, and whether messages were delivered, bounced, or remain queued. If the batch reached people who should not have received it, add them to `suppressions` through the application's suppression flow so they are not contacted again.

**Recover:** correct the template or list, test to an owner address, then re-enable one toggle at a time with approval still on for the first batch. If the error was a mis-click in bulk approval, note that the approval action is audited with the actor and count.

**Evidence:** export of `email_messages` for the window (redact bodies if sharing), count delivered/bounced/queued, suppression changes, audit entries, and the owner's decision on any correction. Check provider reputation/bounce metrics before resuming.

---

## 5. Token/billing discrepancy

**Trigger:** a customer paid but has no credits, credits were granted twice, usage debits do not match the balance, or a chat/form reports "out of credits" after a purchase.

**Diagnose in this order (do not write to the database):**

1. **Gateway:** find the payment in the Razorpay dashboard. Record `payment_id`, order id, amount in minor units, currency, status, and capture time.
2. **Order:** `billing_orders` by `orderId` or `gatewayOrderId`. Check `status`, `credits`, `amount`, `gateway`, `paidAt`, and `settlementResumedAt`.
3. **Events:** `billing_events` by order id. A row means a delivery was processed; the unique `{gateway, eventId}` index makes replay safe.
4. **Ledger:** `wallet_ledger` for the owner and product. Every purchase is a positive row with a reference; every chat/form debit is a negative row with `refId`. `balanceAfter` is the running balance, and rows are append-only.
5. **Usage:** `/app/billing` shows the customer's balance, recent orders, and recent usage for the signed-in account. Admin accounts with `manage_settings` see the grant control there; grants to another account use the audited server action, never a direct insert.

**Recover:**

- **Paid, order still pending:** replay the webhook from the Razorpay dashboard. The handler is idempotent. If the original delivery crashed mid-settlement, the retry resumes after the 60-second settlement lease and credits exactly once.
- **Order paid, no ledger row:** replay after the lease; check the function logs for the settlement error. Do not insert a ledger row by hand.
- **Order paid with the wrong amount/credits:** stop and treat as a pricing/config incident. Record the order id and deploy revision; do not silently adjust the ledger.
- **Double credit:** do not delete or edit ledger rows; they are the audit trail. Record the evidence, apply the owner's support policy (a documented adjustment or grant), and add a regression test if the cause is code.
- **Balance wrong but ledger consistent:** inspect `balanceAfter` chain and the account id. A mismatch between the cached balance and the journal is a code incident; preserve the rows and escalate.

**Evidence:** payment id, order id, event id, ledger row ids, balances before/after, replay timestamps, and the audit entry for any grant. Never paste full gateway payloads into a ticket; redact card and contact data.

---

## 6. Compromised API key or secret

**Rule: revoke at the provider first, rotate second, redeploy third, investigate fourth.** Removing the value from a later commit does not undo exposure.

**Contain and rotate:**

| Secret | Revoke / rotate | Update | Check for abuse |
| --- | --- | --- | --- |
| AI provider key (`AI_API_KEY`, `OPENROUTER_API_KEY`, keys under `/admin/desktop`) | Provider console | Hosting env and `/admin/desktop`; redeploy/restart | `ai_automation_runs` volume and providers; provider usage/billing dashboard |
| SMTP / IMAP password | Mail provider (revoke app password) | Hosting env; restart | Sent folder, `email_messages`, bounces, suppressions |
| Razorpay key secret / webhook secret | Razorpay dashboard | Hosting env; re-register the webhook secret at `/api/billing/webhook`; redeploy | Payments, refunds, `billing_events`, orders |
| MongoDB user password | Atlas database access | `MONGODB_URI` in hosting env; redeploy | Atlas logs, `admin_users`, `audit_log` |
| `AUTH_SECRET` | Generate `openssl rand -base64 32` | Hosting env; redeploy | Active sessions invalidated; signed portal/unsubscribe/report links stop working. Notify customers if links are in flight. |
| `CRON_SECRET` | Generate `openssl rand -hex 16` | Hosting env **and** GitHub Actions repository secret in the same change; redeploy | `/api/cron/run` and `/api/health/bootstrap` invocation logs |
| Google OAuth client secret | Google Cloud console | Hosting env; redeploy | OAuth consent/audit logs, linked customer accounts |
| `INDEXNOW_KEY` | Generate a new key | Hosting env; redeploy; old `/<key>.txt` stops being served | Search submission state; no personal data is exposed |

After rotating the signing secret, verify admin and customer sign-in, and expect older session cookies to be rejected. Rotate one class at a time and keep a timeline; a mass rotation makes it impossible to attribute the abuse.

**Investigate:** `audit_log` (actor, action, hashed IP), job and email history, billing events, provider usage. Preserve logs before retention expires. If a secret was committed to git, revoke it first, then rewrite history with owner approval and redeploy; treat every clone as exposed.

**Verify:** `/api/health?deep=1` shows the expected providers with new credentials; a test sign-in works; one authenticated cron call returns 200; no old-key usage appears at the provider after the rotation timestamp.

**Evidence:** rotation timestamps, provider revocation confirmation, secret names (never values), health JSON, and the abuse review window.

---

## 7. Database restore

**This is destructive and requires explicit owner approval.** Never point a test suite at production: integration suites clear collections in `beforeEach`.

**Preconditions:**

1. Owner approves the restore point and the target (scratch cluster first, production only if necessary).
2. Disable the heartbeat workflow and pause the Vercel daily cron (`vercel.json`) so no job writes during the restore.
3. `/admin/settings` → approval on; `/admin/growth` → external toggles off; `/admin/settings` → autopilot off.
4. Take a fresh backup of the current production database before touching it.

**Atlas (preferred):** use Cloud Manager → Backup → restore. Restore to a **new** cluster or a point-in-time clone first. Validate it, then switch `MONGODB_URI` to the restored cluster and redeploy. Do not overwrite the live cluster until the scratch restore has passed the checks below.

**Self-hosted / manual:**

```bash
# Load secrets from the secret manager; do not echo the URI.
export MONGODB_URI=...          # production or source cluster
export MONGODB_DB_NAME=bitecodes

# 1. Backup the current state before any restore.
mongodump --uri="$MONGODB_URI" --db="$MONGODB_DB_NAME" \
  --archive="/secure/backups/bitecodes-$(date -u +%Y%m%dT%H%M%SZ).archive.gz" --gzip

# 2. Restore into a scratch database on a separate cluster first.
export SCRATCH_MONGODB_URI=...
mongorestore --uri="$SCRATCH_MONGODB_URI" \
  --nsFrom="$MONGODB_DB_NAME.*" --nsTo="bitecodes_restore.*" \
  --archive="/secure/backups/<file>.archive.gz" --gzip
```

Point a local or staging deployment at the scratch database and run the checks. Only then restore production, and only with the owner present.

**Post-restore checks:**

1. Start the app (or redeploy). `getDatabase()` ensures declared indexes on first connection; unique and TTL indexes are recreated. Watch the logs for index-build failures caused by duplicate data and fix the duplicates before retrying.
2. `GET /api/health` returns 200 and reports the expected capability states.
3. `POST /api/health/bootstrap` with `Authorization: Bearer $CRON_SECRET` and `{"dryRun":true}` reports no unexpected missing settings, presets, templates, sequences, or models.
4. Admin sign-in works; a known customer account, chatbot, form, and booking load.
5. Recent orders and wallet balances match the chosen restore point.
6. Send one test email to the owner only; run one manual cron tick and confirm queue counts are sane.
7. Re-enable external toggles one at a time, then the heartbeat workflow and the Vercel daily cron.

Bootstrap never overwrites edited values. It creates a missing settings document, restores the four default discovery presets only when the whole preset list is empty, and seeds missing templates/sequences/models. It does not restore deleted prospects, conversations, or ledger rows; those are governed by the backup/restore point.

**Evidence:** restore point and snapshot id, pre-restore backup path, scratch validation output, health JSON, index list, row counts for critical collections, sign-in result, test email id, and the time the heartbeat resumed.

---

## 8. Post-incident record

Write this in the incident ticket, not in a new plan document:

```text
Incident:
Severity:
Detected at (UTC) / resolved at (UTC):
Affected capability and customer impact:
Root cause:
Containment (exact controls and timestamps):
Recovery:
Evidence links (health JSON, job/order ids, audit entries):
Data exposed? (yes/no, categories, notification decision):
Follow-up action / owner / due date:
```

Then update `upgrade-plan.md` only if the incident exposed a deferred finding or changed the release status. Do not mark a capability healthy until the deep health check and one real end-to-end action have both succeeded.
