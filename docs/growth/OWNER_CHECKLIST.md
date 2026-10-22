# Customer-Magnet Growth Engine: Owner Action Checklist

This checklist documents the actions that cannot be executed in code alone and require owner action, configuration, or credentials before or immediately following deployment.

Related: [`../operations/ENVIRONMENT_SECURITY_PRIVACY.md`](../operations/ENVIRONMENT_SECURITY_PRIVACY.md) (variable matrix and sign-off) and [`../operations/RUNBOOKS.md`](../operations/RUNBOOKS.md) (incident procedures).

---

### [ ] O1. Set Automation Secrets & Crons
- **Action:**
  1. Set `CRON_SECRET` (at least 16 characters) in both the Vercel Project Environment Variables and the GitHub repository secret of the same name. They must match exactly.
  2. Deploy or restart after setting it, then confirm the authenticated endpoints work: `GET /api/cron/run` and `POST /api/health/bootstrap` with `Authorization: Bearer $CRON_SECRET` return 200, while the same calls without the header return 401.
- **Why:** The heartbeat workflow (`.github/workflows/heartbeat.yml`), `/api/cron/run`, and the deep health/bootstrap endpoints refuse to run without the bearer token. Without it, no scheduled job runs and deep health cannot be inspected.

---

### [ ] O2. Configure AI Providers & Review Growth Toggles
- **Action:**
  1. Visit `/admin/desktop` and configure your API keys (NVIDIA NIM, OpenRouter, Groq, Amazon Bedrock, or platform key). Set your preferred fallback order and save.
  2. Visit `/admin/growth` and review automation toggles. Verify which automations should run automatically and keep external outreach toggles off until mailboxes are warmed.
  3. Run `GET /api/health` and confirm AI reports the expected state. If no provider is configured, AI steps are skipped and the capability is `degraded`; this does not stop discovery or the public site.
- **Why:** Automations use the unified provider fallback chain. Cold outbound email and win-back emails are default-disabled for safety.

---

### [ ] O3. Verify Search Console & Bing Webmaster Tools
- **Action:**
  1. Set `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` environment variables (the token only, not the whole meta tag).
  2. Submit `https://www.bitecodes.com/sitemap.xml` to Google Search Console and Bing Webmaster Tools.
  3. Ensure `INDEXNOW_KEY` is configured if using automated IndexNow pings (`search-ping`); the key is served publicly at `/<key>.txt` by design.
  4. Check `/api/health` reports `search-indexing` and `search-pings` as expected.
- **Why:** Search crawlers and IndexNow pings index new service pages, industry guides, and blog content rapidly. A ping never guarantees indexing.

---

### [ ] O4. Local & Business Directory Presence
- **Action:**
  1. Register or claim Google Business Profile as a Service Area Business (covering India, Australia, and global clients).
  2. Verify listings on Clutch, GoodFirms, and relevant tech directories.
- **Why:** Supports the `LocalBusiness` / `ProfessionalService` structured schema and builds domain authority.

---

### [ ] O5. Company Social Profiles
- **Action:**
  1. Confirm your company LinkedIn profile URL and update `siteConfig.socials.linkedin` in `src/lib/site.ts`.
  2. The social drafts automation (`social.drafts`) drafts weekly LinkedIn posts ready for human approval in `/admin/content`.
- **Why:** Provides authentic links in footer and metadata across all marketing pages.

---

### [ ] O6. Email Deliverability (SPF, DKIM, DMARC)
- **Action:**
  1. Set up SPF, DKIM, and DMARC records on your sending domain.
  2. Configure SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`).
  3. Keep prospect email toggles in `/admin/growth` disabled until domain health is verified.
- **Why:** Prevents legitimate client notifications, proposals, and lead confirmations from landing in spam.

---

### [ ] O7. Review Guarantees & Portfolio Case Studies
- **Action:**
  1. Review `src/data/guarantees.ts` and ensure all published commitments (speed, communication, bug fixes) align with your operational SLA.
  2. Review `src/data/projects.ts` and confirm project descriptions, technology tags, and case study outcomes.
- **Why:** Zero fabricated claims are permitted under the Apple-quiet design and honesty guidelines.

---

### [ ] O8. Callback Calling Agent (No Action — Leave Off)
- **Action:**
  1. Keep the `callingAgent` toggle in `/admin/growth` **off**.
  2. Do not attempt to configure telephony credentials: this repository contains no ElevenLabs, Twilio, or other telephony integration, and no environment variables for one are read.
- **Why:** The toggle and the call-request UI exist, but no call can be placed. Enabling it would only create an unused switch. Revisit only after a provider integration, consent capture, and a TRAI DND / Australian Do Not Call compliance procedure have been implemented and reviewed.

---

### [ ] O9. Repository Hygiene & Lead Privacy
- **Action:**
  1. Verify that `docs/leads/` is excluded from git tracking (`git ls-files docs/leads` returns nothing).
  2. If the repository is public, perform a git history rewrite/filter to scrub any historical lead lists, or keep the repository private.
- **Why:** Protects prospect data and prevents accidental exposure of outreach contact lists.

---

### [ ] O10. Finalize Credit Pack Pricing
- **Action:**
  1. Review credit pack prices in `src/data/offers.ts` and `src/lib/pricing.ts`.
  2. Replace any temporary placeholder pricing (`PACKS_ARE_PLACEHOLDER_PRICING`) before launching billing.
- **Why:** Ensures pricing consistency between the public pricing page, project cost calculator, and checkout flow.

---

### [ ] O11. Validate Autonomous First Boot and Health
- **Action:**
  1. Deploy against an empty database (or a fresh database name) with only `MONGODB_URI`, `MONGODB_DB_NAME`, `AUTH_SECRET`, `SITE_URL`, and `CRON_SECRET` set. Do not open the admin panel first.
  2. Confirm the server log records the startup bootstrap, then call `GET /api/health`: it must return 200, list the expected capability states, and show `outbound-sending` as `disabled` with a reason.
  3. Call `POST /api/health/bootstrap` with `{"dryRun":true}` and the bearer token. Confirm settings are present, four default discovery presets exist, seeds report zero missing, the schedule is healthy, and the outbound gate is `closed`.
  4. Open `/admin/growth`, run **Dry run**, then **Reconcile now**, and reload once. Confirm the second run is idempotent: no duplicate settings, presets, templates, sequences, or models; no edited value is overwritten.
  5. Visit `/admin/customers/discover` and confirm the four presets are listed and discovery can run. Auto-contact must remain off; no prospect is contacted.
- **Why:** The deployment contract is that an empty database boots, self-configures, and reports the truth without a setup wizard. The health and dry-run endpoints are the evidence; the bootstrap panel is the human-readable view.

---

### [ ] O12. Backup and Restore Drill
- **Action:**
  1. Confirm the MongoDB provider's backup policy, retention window, and who can trigger a restore.
  2. Restore a recent backup to a **separate** scratch cluster or database using the procedure in `docs/operations/RUNBOOKS.md` §7. Never point the test suite at production; integration suites clear collections.
  3. Validate the restored copy: `/api/health` 200, admin sign-in, a known customer/chatbot/form/booking, recent orders and wallet balances, and a dry-run bootstrap with no unexpected missing records.
  4. Record the restore point, duration, validation result, and the date of the next drill.
- **Why:** An untested backup is not a recovery plan. The drill also verifies that index creation and bootstrap reconciliation work after a restore.
