# Bitecodes Customer-Magnet Growth Plan (v1, 2026-10-18)

## Executive summary

- **Goal.** Turn bitecodes.com into a system that attracts, converts, and keeps customers, with every one of the 54 requested capabilities either built in this repository or, where it cannot be built in code, reduced to a short owner checklist.
- **Engine.** All recurring automations run on the existing Mongo job queue, scheduled from one declarative registry (`src/lib/server/jobs/schedule.ts`) and driven by the GitHub Actions heartbeat plus a daily Vercel cron backup.
- **AI.** Every automation calls one client (`src/lib/server/ai/automation.ts`) that uses the **same operator provider chain as the Notes desktop AI tool**: the default provider and fallback order configured in `/admin/desktop` (NVIDIA NIM, OpenRouter, Groq, Amazon Bedrock), then the platform `AI_API_KEY` as a last resort. A provider that fails, times out, or returns invalid JSON is skipped and the next one is tried.
- **Safety defaults.** Automations that only write internal data or email the owner are **on**. Automations that email prospects or customers are **off** (or land in the approval queue) until the owner switches them on in `/admin/growth`.
- **Honesty.** No fabricated testimonials, metrics, reviews, logos, or SLAs. Placeholder proof found in the repository is removed; real proof is collected through a consented feedback pipeline.

## Decisions taken (the owner asked for no questions)

| # | Decision | Reason |
|---|----------|--------|
| D1 | Automations use the desktop operator chain, independent of the desktop on/off switch, gated by a separate `growth.aiEnabled` setting. | One place to manage keys and fallback order, as requested. |
| D2 | Primary offer for the studio is a **free website audit** and a **free 30-minute strategy call**; the SaaS products keep "Get started free" on their own pages. | Low-friction offers convert cold visitors; resolves the header-versus-hero CTA conflict. |
| D3 | AI blog posts become drafts awaiting review by default (`growth.blogAutoPublish = false`), carry an AI-assisted disclosure, and are bylined "Bitecodes Editorial". | Live posts were near-duplicates published under the founder's name with no review. |
| D4 | Outbound prospect email stays behind the existing approval queue; AI only drafts. | Spam Act 2003 (AU), CAN-SPAM, and India IT rules; reputational risk. |
| D5 | The AI calling agent places **callback calls only**, to people who requested one and ticked a consent box; it is disabled until telephony credentials are set. | Cold-calling rules (TRAI DND, AU Do Not Call Register). |
| D6 | Guarantees are conservative, process-based commitments kept in one data file for the owner to confirm before merge. | An unfunded SLA is worse than none. |
| D7 | ICP: (a) small and mid-sized service businesses in India and Australia (healthcare and allied health, NDIS and aged care, education, trades and construction, professional services, hospitality and retail) whose website is outdated, slow, or lacks booking and chat; (b) self-serve SaaS buyers among the same businesses. | Matches the two prospect-research batches already run. |
| D8 | Third-party contact data in `docs/leads/` is untracked from this **public** repository and ignored going forward. History still contains it (owner action O9). | Privacy. |
| D9 | Work ships as a pull request, not a production merge. | Owner reviews copy, guarantees, and toggles first. |

## Automation schedule

All times are UTC (IST = UTC + 5:30). "Gate" is the `/admin/growth` toggle.

| Automation | Job type | Cadence | Gate default | What it does |
|---|---|---|---|---|
| Analytics roll-up | `analytics.rollup` | Daily 01:00 | On | Aggregates first-party page views, events, UTM sources, and Web Vitals into daily rows. |
| Site-assistant review | `chat.summaries` | Daily 01:00 | On | AI summarises yesterday's website chats, extracts leads and unanswered questions. |
| Churn scan | `churn.scan` | Daily 02:00 | On (scoring) / Off (win-back email) | Scores every SaaS customer for churn risk; optional win-back email. |
| Lead scoring and qualification | `lead.score` | Daily 02:00 | On | Deterministic ICP score plus an AI qualification note for each new or changed lead. |
| AI prospect research | `prospect.research` | Daily 03:00 | On | AI reads each newly enriched prospect's audit and site facts and writes a research brief. |
| Personalised outreach drafts | `outreach.draft` | Daily 03:00 | On (drafts only) | AI writes a personalised first line and pitch per qualified prospect into the approval queue. |
| Owner daily digest | `digest.daily` | Daily 04:00 | Always | Leads, pipeline, analytics, approvals, churn, proposals, content awaiting review. |
| Customer lifecycle | `lifecycle.tick` | Daily 05:00 | Off | Onboarding nudges, credit-runway renewal reminders, upsell and cross-sell suggestions. |
| Search-engine ping | `search.ping` | Daily 06:00 | On | IndexNow ping for pages changed in the last day. |
| Proposal follow-ups | `proposal.followups` | Daily 06:00 | On | Reminds the owner about proposals viewed but not accepted; expires stale ones. |
| Booking reminders | `booking.reminders` | Every 15 min | On | Reminder emails 24 h and 1 h before a booked call. |
| Weekly growth report | `report.weekly` | Monday 03:00 | On | AI-written executive summary of the week for the owner. |
| Social post drafts | `social.drafts` | Monday 04:00 | On | Drafts LinkedIn posts in the founder's voice from recent articles; never posts. |
| Feedback requests | `feedback.requests` | Wednesday 05:00 | Off | NPS survey to eligible customers; consenting promoters are invited to leave a testimonial. |
| Newsletter draft | `newsletter.draft` | Thursday 04:00 | On (draft only) | Drafts the weekly newsletter for approval. |
| Blog generation | `blog.generate` | Tuesday and Friday 05:00 | On (draft) | AI drafts an article from an ICP topic cluster, skipping topics already covered. |
| SEO self-audit | `seo.selfaudit` | Sunday 02:00 | On | Runs the website auditor against key bitecodes.com pages and reports regressions. |
| Monthly customer report | `report.monthly` | 1st of month 04:00 | Off | Emails each SaaS customer their usage and results, with AI insights. |

Existing automations (sequence tick, autopilot, reply polling, scheduled publishing) keep their cadence and move into the same registry.

## The 54 items

Legend: **Built** = code in this pull request. **Owner** = action only a human can take (see the owner checklist).

### Visibility

1. **SEO.** Keyword-led homepage title; enriched service pages (deliverables, timeline, FAQs, related work); industry pages; correct `sameAs`. Owner: Search Console and Bing verification.
2. **GEO.** `llms.txt` and `llms-full.txt` facts derived from pricing data with a test that fails on drift; factual company facts block; promotional self-answers removed.
3. **AEO.** FAQ answers rendered in HTML (`<details>`), answer-first summaries and `speakable` on articles, FAQPage data on service and industry pages.
4. **UI/UX optimisation.** One CTA hierarchy (D2), mobile sticky CTA, design-rule regressions fixed, accessibility checks.
5. **Landing page optimisation.** Hero rewritten around the free audit; proof and process above the fold; offer-specific landing on `/website-audit` and `/demo`.
6. **Technical SEO.** Sitemap coverage for new routes, Search Console verification tags from env, IndexNow daily ping, redirects for duplicate AI posts, weekly self-audit.
7. **Content marketing.** Repaired blog pipeline (topic clusters from the ICP, duplicate guard, review gate), newsletter, weekly social drafts.
8. **Local SEO.** LocalBusiness/ProfessionalService data with the real service area; no doorway city pages. Owner: Google Business Profile and citations.
9. **CRO.** Thank-you pages with next steps and booking, friction removed from forms, exit points tracked, consented testimonials surfaced.
10. **Website analytics.** Cookieless first-party analytics (page views, events, UTM, Web Vitals), daily roll-up, `/admin/analytics` with a funnel.

### Acquisition

11. **ICP.** `src/data/icp.ts` defines segments, signals, and disqualifiers; scoring, research, and topic selection read it.
12. **Lead database building.** CSV import of prospects with de-duplication and suppression checks; existing map discovery kept.
13. **Lead magnets.** `/resources` with ungated guides and email-gated checklists; consented newsletter sign-up.
14. **Free demos.** `/demo`: live product demos and a bookable demo call.
15. **Personalised audits.** Website audit captures an email with consent, adds an AI-written plain-language summary, and offers a call.
16. **Lead qualification.** Daily AI qualification note (need, budget signal, timeline, fit) on every lead.
17. **CRM.** Unified inbox (enquiries, consultant, audits, forms, bookings, chats, calls), pipeline board, next action dates, notes, prospect-to-lead conversion.
18. **Automated follow-ups.** Inbound follow-up sequences for consenting leads; working open and click tracking (the `/e/o` and `/e/c` routes were missing).
19. **Sales proposals.** Proposal builder from a lead, AI-drafted scope, public proposal page with acceptance, view tracking, follow-up reminders.
20. **Offer and pricing strategy.** Clear packages with what is included, calculator floor aligned with published prices.
21. **Social proof.** Only verifiable proof: shipped projects, live products, consented testimonials; placeholder testimonials deleted.
22. **Sales funnel optimisation.** Funnel from visit to won deal with stage conversion rates in admin and in the weekly report.

### Trust

23. **Case studies.** Portfolio entries restructured (challenge, approach, outcome) without invented metrics; filters by industry and service.
24. **Portfolio development.** Related work on service and industry pages; "add a project" structure documented.
25. **Customer testimonials.** Collection, consent, moderation, and display pipeline.
26. **Founder-led content.** Founder notes in the blog, weekly LinkedIn drafts in the founder's voice. Owner: review the bio and post.
27. **Educational content.** Service FAQs, guides in `/resources`, topic clusters for the blog.
28. **Industry-specific pages.** `/industries/[slug]` for each served industry, honest about where case studies exist.
29. **Transparent pricing.** Every price public, inclusions and payment terms stated, `llms.txt` pricing derived from source.
30. **Guarantees and SLAs.** `/guarantees` page from `src/data/guarantees.ts`; "SLA-backed" wording replaced by the published commitments. Owner: confirm each commitment.
31. **Consistent branding.** Hard-coded colours replaced by tokens, naming consistency, social profiles corrected.

### AI automation

32. **AI lead research.** `prospect.research` job (daily).
33. **AI-personalised outreach.** `outreach.draft` job (daily, approval queue).
34. **AI chatbot.** Site assistant on bitecodes.com with conversation storage, lead capture, booking hand-off; product page claims corrected.
35. **AI calling agent.** Consent-based callback agent through ElevenLabs Conversational AI and Twilio; call log and transcripts in admin. Owner: telephony account and number.
36. **Automated booking.** Discovery-call booking with reminders and lead creation.
37. **Marketing automation.** Newsletter, inbound nurture, lifecycle emails, all consent-gated.
38. **AI content generation.** Blog drafts, social drafts, newsletter drafts, audit summaries, proposal scopes.
39. **Lead scoring.** `src/lib/leads/score.ts`, recomputed daily and on events.
40. **Automated reporting.** Daily digest, weekly growth report, monthly customer reports.

### Retention

41. **Customer onboarding.** Checklist on the customer dashboard and an onboarding email series.
42. **Monthly performance reports.** `/app/reports` and the monthly email.
43. **Upselling.** Usage-based pack recommendations; project-to-maintenance retainer offer in proposals.
44. **Cross-selling.** Product recommendations based on what each customer already uses.
45. **Renewal campaigns.** Credit-runway projection and reminders before balances run out.
46. **Customer feedback.** NPS survey, in-app feedback, admin feedback inbox.
47. **Referral incentives.** Referral codes, bonus credits for both sides after the first purchase, `/referral` terms page.
48. **Churn prevention.** Daily risk score, at-risk list in admin, optional win-back email.

(Items 49 to 54 in the request were grouped headings; every listed capability above is covered.)

## Owner checklist (cannot be done in code)

- O1. Confirm `CRON_SECRET` is set in both Vercel and GitHub secrets (automations do not run without it).
- O2. Configure provider keys and fallback order in `/admin/desktop`; review toggles in `/admin/growth`.
- O3. Verify Google Search Console and Bing Webmaster Tools (`GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`), then submit `/sitemap-index.xml`.
- O4. Create a Google Business Profile as a service-area business; list on Clutch, GoodFirms, and relevant directories.
- O5. Create a company LinkedIn page and set its URL in `src/lib/site.ts`.
- O6. Set up a domain mailbox with SPF, DKIM, and DMARC before enabling any customer or prospect email toggle.
- O7. Confirm every commitment in `src/data/guarantees.ts` and every project in `src/data/projects.ts`.
- O8. For the calling agent: ElevenLabs agent, Twilio number, and the `ELEVENLABS_*` variables.
- O9. Purge `docs/leads/` from git history (history rewrite and force-push) or make the repository private.
- O10. Replace placeholder credit-pack prices (`PACKS_ARE_PLACEHOLDER_PRICING`).
