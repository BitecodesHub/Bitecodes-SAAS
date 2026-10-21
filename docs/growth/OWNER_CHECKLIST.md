# Customer-Magnet Growth Engine: Owner Action Checklist

This checklist documents the actions that cannot be executed in code alone and require owner action, configuration, or credentials before or immediately following deployment.

---

### [ ] O1. Set Automation Secrets & Crons
- **Action:** Ensure `CRON_SECRET` is defined in both your Vercel Project Environment Variables and GitHub Repository Secrets (`CRON_SECRET`).
- **Why:** The automated background heartbeat workflow (`.github/workflows/heartbeat.yml`) and `/api/cron/run` rely on `Bearer ${CRON_SECRET}` authorization to execute pending jobs safely.

---

### [ ] O2. Configure AI Providers & Review Growth Toggles
- **Action:**
  1. Visit `/admin/desktop` and configure your API keys (NVIDIA NIM, OpenRouter, Groq, Amazon Bedrock, or platform key). Set your preferred fallback order.
  2. Visit `/admin/growth` and review automation toggles. Verify which automations should run automatically and keep external outreach toggles off until mailboxes are warmed.
- **Why:** Automations use the unified provider fallback chain. Cold outbound email and win-back emails are default-disabled for safety.

---

### [ ] O3. Verify Search Console & Bing Webmaster Tools
- **Action:**
  1. Set `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` environment variables.
  2. Submit `https://bitecodes.com/sitemap.xml` to Google Search Console and Bing Webmaster Tools.
  3. Ensure `INDEXNOW_KEY` is configured if using automated IndexNow pings (`search.ping`).
- **Why:** Search crawlers and IndexNow pings index new service pages, industry guides, and blog content rapidly.

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

### [ ] O8. Voice Calling Agent Credentials (Optional)
- **Action:**
  1. If activating the automated callback calling agent (`/admin/calls`), set `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, and Twilio credentials.
  2. Keep calling agent disabled until telephony credentials and consent procedures are validated.
- **Why:** Complies with TRAI DND regulations (India) and the Australian Do Not Call Register.

---

### [ ] O9. Repository Hygiene & Lead Privacy
- **Action:**
  1. Verify that `docs/leads/` is excluded from git tracking.
  2. If the repository is public, perform a git history rewrite/filter to scrub any historical lead lists, or keep repository private.
- **Why:** Protects prospect data and prevents accidental exposure of outreach contact lists.

---

### [ ] O10. Finalize Credit Pack Pricing
- **Action:**
  1. Review credit pack prices in `src/data/offers.ts` and `src/lib/pricing.ts`.
  2. Replace any temporary placeholder pricing (`PACKS_ARE_PLACEHOLDER_PRICING`) before launching billing.
- **Why:** Ensures pricing consistency between the public pricing page, project cost calculator, and checkout flow.
