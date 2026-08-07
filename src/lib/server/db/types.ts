import "server-only";

import type { ObjectId } from "mongodb";
import type { WebsiteAuditResult } from "@/lib/website-audit";
import type { BlogBlock } from "@/types/content";
import type { EmailBlock } from "@/lib/email/template";

export type { EmailBlock };

/**
 * Document shapes for every MongoDB collection.
 *
 * These are the single source of truth for the data layer: `collections.ts`
 * binds each name to the interface below so callers get a typed
 * `Collection<T>` rather than `Collection<Document>`.
 */

/** Common fields every document carries. */
interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Inbound leads
// ---------------------------------------------------------------------------

export type LeadStatus =
  | "new"
  | "qualified"
  | "proposal"
  | "won"
  | "lost"
  | "spam";

export type EmailDeliveryStatus = "pending" | "sent" | "failed";

/** A note attached to a lead or prospect by an admin user. */
export interface ActivityNote {
  id: string;
  body: string;
  /**
   * Null for notes the system writes itself — an enrichment failure, an
   * automated status change. Those need to appear on the timeline alongside
   * human notes, and attributing them to a fake user id would be worse.
   */
  authorId: string | null;
  authorName: string;
  createdAt: Date;
}

/**
 * Website contact form submissions. Pre-existing collection — the fields
 * below match what `src/app/api/contact/route.ts` already writes, plus the
 * CRM fields the admin panel adds.
 */
export interface ContactEnquiryDoc extends Timestamped {
  _id?: ObjectId;
  requestId: string;
  reference: string;
  name: string;
  email: string;
  company: string | null;
  budget: string | null;
  message: string;
  role: string | null;
  source: string;
  status: LeadStatus;
  emailStatus: EmailDeliveryStatus;
  emailsSentAt?: Date;
  /** CRM additions — all optional so existing documents stay valid. */
  assignedToId?: string | null;
  notes?: ActivityNote[];
  tags?: string[];
  lastContactedAt?: Date | null;
}

/** A persisted AI project consultant submission (previously discarded). */
export interface ConsultantRequestDoc extends Timestamped {
  _id?: ObjectId;
  requestId: string;
  reference: string;
  /** The submitted brief. Untrusted user input — never rendered as HTML. */
  input: Record<string, unknown>;
  /** Deterministic quote produced by `consultant-quote.ts`. */
  quote: Record<string, unknown> | null;
  /** Model recommendation, when the provider succeeded. */
  recommendation: Record<string, unknown> | null;
  model: string | null;
  email: string | null;
  status: LeadStatus;
  notes?: ActivityNote[];
  /** CRM additions, shared with the other lead sources. */
  assignedToId?: string | null;
  tags?: string[];
  lastContactedAt?: Date | null;
}

/** A persisted public website audit run (previously discarded). */
export interface AuditReportDoc extends Timestamped {
  _id?: ObjectId;
  requestId: string;
  /** Normalised URL that was audited. */
  auditedUrl: string;
  hostname: string;
  result: WebsiteAuditResult;
  /** Set when the visitor asked for the report by email. */
  email: string | null;
  source: "public-tool" | "prospect-enrichment";
  /** Signed-token id for the shareable report page, when one was issued. */
  shareId: string | null;
  /**
   * CRM fields. Optional because audits are written by a public route that
   * knows nothing about the pipeline; the inbox defaults a missing status to
   * `new` rather than requiring a migration.
   */
  status?: LeadStatus;
  notes?: ActivityNote[];
  assignedToId?: string | null;
  tags?: string[];
  lastContactedAt?: Date | null;
}

// ---------------------------------------------------------------------------
// Admin identity
// ---------------------------------------------------------------------------

export type AdminRole = "owner" | "admin" | "editor" | "viewer";

export interface AdminUserDoc extends Timestamped {
  _id?: ObjectId;
  /** Lowercased, trimmed. Unique. */
  email: string;
  name: string;
  role: AdminRole;
  /** `scrypt` output, encoded by `password.ts`. Never leaves the server. */
  passwordHash: string;
  status: "active" | "invited" | "disabled";
  /** Base32 TOTP secret. Present only once two-factor auth is enabled. */
  totpSecret?: string | null;
  totpEnabledAt?: Date | null;
  failedAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  /** Forces re-authentication when the password changes. */
  sessionEpoch: number;
}

export interface AdminSessionDoc {
  _id?: ObjectId;
  /** SHA-256 of the opaque session token. The token itself is never stored. */
  tokenHash: string;
  userId: string;
  role: AdminRole;
  sessionEpoch: number;
  /** Hashed so a database leak does not expose visitor IP addresses. */
  ipHash: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Single-use tokens for password reset, magic links, and invitations. */
export interface AdminTokenDoc {
  _id?: ObjectId;
  tokenHash: string;
  userId: string;
  purpose: "password-reset" | "invite" | "login-link";
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface AuditLogDoc {
  _id?: ObjectId;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  /** Collection + id the action applied to, when applicable. */
  target: { type: string; id: string } | null;
  /** Small, non-sensitive detail payload for the activity feed. */
  detail: Record<string, unknown> | null;
  ipHash: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

/**
 * Shared rate-limit counters. Replaces the in-process Map so limits hold
 * across instances. `expiresAt` drives a TTL index for cleanup.
 */
export interface RateLimitDoc {
  _id: string;
  count: number;
  resetAt: Date;
  expiresAt: Date;
}

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobDoc {
  _id?: ObjectId;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  /** Earliest time the job may run. Drives delays and backoff. */
  runAt: Date;
  attempts: number;
  maxAttempts: number;
  /** Held by a worker while running; lets a crashed worker's job be reclaimed. */
  lockedUntil: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  result: Record<string, unknown> | null;
  /** Deduplicates enqueues. Unique when present. */
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/** Cached third-party responses (Overpass, Nominatim). TTL-expired. */
export interface DiscoveryCacheDoc {
  _id: string;
  provider: string;
  payload: unknown;
  createdAt: Date;
  expiresAt: Date;
}

/** Editable overrides for `siteConfig` and feature flags. Single document. */
export interface SiteSettingsDoc extends Timestamped {
  _id: string;
  contact?: {
    email?: string;
    salesEmail?: string;
    phone?: string;
    phoneHref?: string;
    address?: {
      line1?: string;
      city?: string;
      region?: string;
      country?: string;
      full?: string;
      /** Postal address required in outreach email footers. */
      postal?: string;
    };
  };
  automation?: {
    /** When false, outreach sends without human approval. Default true. */
    requireApproval?: boolean;
    /** Per recipient-domain daily send cap. */
    perDomainDailyCap?: number;
    globalDailyCap?: number;
    /** Holds recipients in consent-required jurisdictions for manual release. */
    blockConsentRequiredRegions?: boolean;
    /** Automatically enrich prospects after discovery. Default true. */
    autoEnrich?: boolean;
    /** Harvest contact emails from prospect websites. Default true. */
    harvestEmails?: boolean;
    /** Master switch for the hands-off pipeline. Default false. */
    autopilot?: boolean;
    /** Minimum classification score for automatic enrolment. */
    autopilotScoreThreshold?: number;
    /** Ceiling on automatic enrolments per UTC day. */
    autopilotDailyEnrollCap?: number;
  };
  ai?: {
    model?: string;
    chatModel?: string;
    chatEnabled?: boolean;
  };
  map?: {
    tileUrl?: string;
    tileAttribution?: string;
  };
  outreach?: {
    senderName?: string;
    fromAddress?: string;
    replyTo?: string;
  };
}

export interface AnalyticsEventDoc {
  _id?: ObjectId;
  type: "pageview" | "vital" | "event";
  path: string;
  name: string | null;
  value: number | null;
  /** Coarse referrer host only — never a full URL with query. */
  referrerHost: string | null;
  /** Daily-rotating salted hash. Not reversible to a visitor. */
  visitorHash: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

export type BlogStatus = "draft" | "scheduled" | "published" | "archived";

export interface BlogPostDoc extends Timestamped {
  _id?: ObjectId;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  author: string;
  /** ISO date string, matching the static `BlogPost.date` contract. */
  date: string;
  readingMinutes: number;
  body: BlogBlock[];
  featured: boolean;
  status: BlogStatus;
  /** Meta description override; falls back to `excerpt`. */
  metaDescription: string | null;
  /** FAQ pairs rendered as FAQPage structured data. */
  faq: { question: string; answer: string }[];
  /** Internal links validated against real site routes. */
  internalLinks: { label: string; path: string }[];
  publishedAt: Date | null;
  scheduledFor: Date | null;
  authorId: string | null;
  /** True when any part of the draft came from the model. */
  aiAssisted: boolean;
  aiModel: string | null;
  revision: number;
}

export interface BlogRevisionDoc {
  _id?: ObjectId;
  postId: string;
  revision: number;
  snapshot: Omit<BlogPostDoc, "_id">;
  authorId: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Outbound prospecting
// ---------------------------------------------------------------------------

export type ProspectTag =
  | "no-website"
  | "website-down"
  | "not-mobile-friendly"
  | "slow-website"
  | "insecure-website"
  | "seo-gaps"
  | "accessibility-gaps"
  | "feature-upgrade"
  | "strong-website";

export type ProspectStatus =
  | "discovered"
  | "enriching"
  | "qualified"
  | "queued"
  | "contacted"
  | "replied"
  | "meeting"
  | "won"
  | "lost"
  | "suppressed";

/** Signals extracted from a prospect's homepage during enrichment. */
export interface ProspectSignals {
  reachable: boolean;
  https: boolean;
  responsive: boolean;
  responseTimeMs: number | null;
  htmlBytes: number | null;
  hasStructuredData: boolean;
  hasFavicon: boolean;
  hasOpenGraph: boolean;
  hasAnalytics: boolean;
  hasBooking: boolean;
  hasEcommerce: boolean;
  hasChat: boolean;
  hasBlog: boolean;
  hasContactForm: boolean;
  hasSocialLinks: boolean;
  platform: string | null;
  copyrightYear: number | null;
}

export interface ProspectClassification {
  /** Primary reason this business is a prospect. */
  primaryTag: ProspectTag;
  tags: ProspectTag[];
  /** 0-100. Higher means a stronger, more winnable opportunity. */
  score: number;
  /** Ordered talking points for outreach, most compelling first. */
  pitchAngles: string[];
  /** Short human-readable issue list used in email templates. */
  topIssues: string[];
}

export interface ProspectDoc extends Timestamped {
  _id?: ObjectId;
  /** Data provider. `osm` is the default; `manual` for CSV imports. */
  source: "osm" | "google" | "manual";
  /** Provider-native id, e.g. `node/123456`. Unique with `source`. */
  sourceId: string;
  /** Normalised `name|lat|lng` key used to dedupe across providers. */
  dedupeKey: string;
  name: string;
  category: string | null;
  categoryLabel: string | null;
  phone: string | null;
  email: string | null;
  /** How the email was obtained, for compliance record-keeping. */
  emailSource: "provider" | "website" | "manual" | null;
  website: string | null;
  /**
   * A social or link-in-bio page found where a website should be.
   *
   * Kept apart from `website` on purpose. A business whose only web presence is
   * a Facebook page or a `business.site` one-pager is commercially a
   * no-website prospect — it has no domain, no SEO, and no control — so storing
   * that URL in `website` would hide the strongest lead in the set.
   */
  socialUrl: string | null;
  /** Final URL after redirects, when enrichment reached the site. */
  websiteFinalUrl: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
  searchId: string | null;
  status: ProspectStatus;
  classification: ProspectClassification | null;
  signals: ProspectSignals | null;
  auditReportId: string | null;
  auditScore: number | null;
  /** Token id for the shareable personalised report. */
  reportShareId: string | null;
  tags: string[];
  notes?: ActivityNote[];
  assignedToId?: string | null;
  enrichedAt: Date | null;
  enrichmentError: string | null;
  lastContactedAt: Date | null;
  contactCount: number;
}

/**
 * A saved discovery search the autopilot re-runs on a cadence — the standing
 * order that keeps the pipeline fed without anyone opening the map.
 */
export interface AutopilotPresetDoc extends Timestamped {
  _id?: ObjectId;
  presetId: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  categories: string[];
  /** Hours between automatic re-runs of this search. */
  cadenceHours: number;
  enabled: boolean;
  lastRunAt: Date | null;
  /** searchId of the most recent run, for drill-down from the console. */
  lastSearchId: string | null;
  createdById: string | null;
}

export interface ProspectSearchDoc extends Timestamped {
  _id?: ObjectId;
  searchId: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  categories: string[];
  provider: "osm" | "google";
  status: "queued" | "running" | "completed" | "failed";
  discovered: number;
  added: number;
  skipped: number;
  error: string | null;
  createdById: string | null;
  completedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Email engine
// ---------------------------------------------------------------------------

export interface EmailTemplateDoc extends Timestamped {
  _id?: ObjectId;
  /** Stable key, e.g. `outreach.no-website` or `transactional.welcome`. */
  key: string;
  name: string;
  description: string;
  subject: string;
  /** Body as paragraphs/bullets so it can render to both HTML and text. */
  blocks: EmailBlock[];
  /** Variables the template references, for editor validation. */
  variables: string[];
  category: "outreach" | "transactional" | "nurture" | "internal";
  /** Prospect tag this template targets, for outreach templates. */
  prospectTag: ProspectTag | null;
  enabled: boolean;
  /** True while the seeded default has not been edited by a human. */
  isDefault: boolean;
}

export type EmailMessageStatus =
  | "draft"
  | "pending_approval"
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled"
  | "skipped";

export interface EmailMessageDoc extends Timestamped {
  _id?: ObjectId;
  messageId: string;
  to: string;
  toName: string | null;
  from: string;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  templateKey: string | null;
  category: EmailTemplateDoc["category"];
  status: EmailMessageStatus;
  /** Why a message was skipped — suppression, cap, or region guard. */
  skipReason: string | null;
  prospectId: string | null;
  leadId: string | null;
  enrollmentId: string | null;
  sequenceStep: number | null;
  approvedById: string | null;
  approvedAt: Date | null;
  sendAfter: Date;
  sentAt: Date | null;
  failedAt: Date | null;
  lastError: string | null;
  attempts: number;
  providerMessageId: string | null;
  opens: Date[];
  clicks: { url: string; at: Date }[];
  /** Signed id used by the tracking pixel and click redirect. */
  trackingId: string;
}

export interface EmailSequenceDoc extends Timestamped {
  _id?: ObjectId;
  key: string;
  name: string;
  description: string;
  /** Which prospect tag auto-enrols into this sequence, if any. */
  prospectTag: ProspectTag | null;
  enabled: boolean;
  steps: {
    templateKey: string;
    /** Delay from enrolment (step 1) or from the previous step. */
    delayHours: number;
  }[];
  /** Stop the sequence when the recipient clicks a tracked link. */
  stopOnClick: boolean;
}

export interface SequenceEnrollmentDoc extends Timestamped {
  _id?: ObjectId;
  enrollmentId: string;
  sequenceKey: string;
  prospectId: string | null;
  leadId: string | null;
  email: string;
  status: "active" | "completed" | "stopped";
  stoppedReason: string | null;
  currentStep: number;
  nextRunAt: Date | null;
}

export interface SuppressionDoc {
  _id?: ObjectId;
  /** Lowercased email, or `@domain` for a whole-domain block. */
  value: string;
  reason: "unsubscribed" | "bounced" | "complaint" | "manual" | "invalid";
  detail: string | null;
  createdAt: Date;
}

export interface NewsletterSubscriberDoc extends Timestamped {
  _id?: ObjectId;
  email: string;
  name: string | null;
  status: "pending" | "subscribed" | "unsubscribed";
  source: string;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Site paths the answer was grounded in. */
  sources: string[];
  /** Set when the model could not answer from site knowledge. */
  unanswered?: boolean;
  createdAt: Date;
}

export interface ChatConversationDoc extends Timestamped {
  _id?: ObjectId;
  conversationId: string;
  messages: ChatMessage[];
  visitorHash: string;
  /** Captured when the visitor shares contact details. */
  email: string | null;
  name: string | null;
  leadCreated: boolean;
  /** Any turn the model flagged as unanswerable from site content. */
  hasUnanswered: boolean;
  reviewedAt: Date | null;
  /** Admin action taken on a flagged question. */
  resolution: "faq" | "blog-topic" | "ignored" | null;
  model: string | null;
  lastMessageAt: Date;
}

/** Admin-authored answers injected into the chatbot's retrieval index. */
export interface ChatKnowledgeDoc extends Timestamped {
  _id?: ObjectId;
  question: string;
  answer: string;
  /** Extra search terms that should match this entry. */
  keywords: string[];
  /** Site path the answer links to, when relevant. */
  path: string | null;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Client onboarding and portal
// ---------------------------------------------------------------------------

export interface ProjectMilestone {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "done";
  dueDate: string | null;
  completedAt: Date | null;
}

export interface OnboardingStepState {
  key: string;
  completedAt: Date | null;
  /** Client-supplied answers. Untrusted input — escaped on render. */
  data: Record<string, unknown> | null;
}

export interface ProjectDoc extends Timestamped {
  _id?: ObjectId;
  projectId: string;
  name: string;
  clientName: string;
  clientEmail: string;
  company: string | null;
  status: "onboarding" | "active" | "paused" | "delivered" | "cancelled";
  summary: string | null;
  milestones: ProjectMilestone[];
  onboarding: OnboardingStepState[];
  leadId: string | null;
  ownerId: string | null;
  invitedAt: Date | null;
  onboardingCompletedAt: Date | null;
}

export interface MeetingDoc extends Timestamped {
  _id?: ObjectId;
  meetingId: string;
  projectId: string | null;
  leadId: string | null;
  name: string;
  email: string;
  /** Stored in UTC; rendered in the site's configured timezone. */
  startsAt: Date;
  durationMinutes: number;
  timezone: string;
  purpose: string;
  status: "booked" | "cancelled" | "completed";
  notes: string | null;
}

/** Passwordless client portal sessions. Separate from admin sessions. */
export interface PortalSessionDoc {
  _id?: ObjectId;
  tokenHash: string;
  projectId: string;
  email: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

// ---------------------------------------------------------------------------
// AI Chatbot SaaS
//
// Multi-tenant: every document carries `ownerId` (the customer). The widget's
// public path is scoped by `chatbotId` + a public token that grants chat only.
// See docs/ai-chatbot-saas-architecture.md.
// ---------------------------------------------------------------------------

export type ChatbotStatus = "active" | "paused";

/** Public-safe appearance/behaviour, resolved for the embeddable widget. */
export interface ChatbotAppearance {
  theme: "light" | "dark" | "auto";
  avatar: string | null;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  position: "bottom-right" | "bottom-left";
  size: "compact" | "regular" | "large";
  displayMode: "bubble" | "popup" | "fullscreen" | "embedded";
  welcomeMessage: string;
  placeholder: string;
  typingAnimation: boolean;
  branding: boolean;
  language: string;
  timezone: string;
  suggestedQuestions: string[];
  starterPrompts: string[];
}

export interface ChatbotDoc extends Timestamped {
  _id?: ObjectId;
  chatbotId: string;
  ownerId: string;
  name: string;
  description: string | null;
  websiteName: string | null;
  status: ChatbotStatus;
  /** Domains the widget may run on. Supports `*.company.com` wildcards. */
  allowedDomains: string[];
  appearance: ChatbotAppearance;
  /** Key of the model this bot uses; must be an admin-enabled model. */
  modelKey: string | null;
  /** Active system-prompt version content (denormalised for the hot path). */
  systemPrompt: string;
  /** SHA-256 of the public widget token. The token itself is never stored. */
  publicTokenHash: string;
}

export type KnowledgeSourceType = "file" | "url" | "sitemap" | "manual" | "faq";

export type KnowledgeStatus = "queued" | "processing" | "indexed" | "failed";

export interface KnowledgeSourceDoc extends Timestamped {
  _id?: ObjectId;
  ownerId: string;
  chatbotId: string;
  type: KnowledgeSourceType;
  /** Filename, URL, or a short label for manual entries. */
  origin: string;
  status: KnowledgeStatus;
  bytes: number;
  chunkCount: number;
  error: string | null;
}

export interface KnowledgeChunkDoc {
  _id?: ObjectId;
  ownerId: string;
  chatbotId: string;
  sourceId: string;
  /** Order within the source. */
  ord: number;
  text: string;
  tokenCount: number;
  /** Embedding vector. Indexed by Atlas Vector Search in production. */
  embedding: number[];
  meta: { title: string | null; url: string | null };
  createdAt: Date;
}

/** Server-to-server API keys a customer creates. */
export interface ChatbotApiKeyDoc extends Timestamped {
  _id?: ObjectId;
  ownerId: string;
  name: string;
  /** SHA-256 of the secret. Only the hash is stored. */
  keyHash: string;
  /** First chars shown in the UI, e.g. `sk_live_a1b2…`. */
  prefix: string;
  scopes: string[];
  allowedDomains: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  status: "active" | "revoked";
}

/** Admin-managed catalogue of AI models available to customers. */
export interface ChatbotModelDoc extends Timestamped {
  _id?: ObjectId;
  key: string;
  label: string;
  provider: string;
  /** Cost per 1M tokens, in the platform's accounting currency. */
  inCostPerMTok: number;
  outCostPerMTok: number;
  maxContext: number;
  maxOutput: number;
  tempMin: number;
  tempMax: number;
  enabled: boolean;
  /** Plans this model is available on; empty means all plans. */
  planIds: string[];
  isDefault: boolean;
}

// ---------------------------------------------------------------------------
// Prepaid credit wallet (shared by every metered product)
// ---------------------------------------------------------------------------

/**
 * Which metered good a balance belongs to. Chatbot tokens and form-submission
 * credits are separately purchased, so they must never share a pool.
 */
export type WalletProduct = "chatbot" | "forms";

/**
 * Fast, authoritative balance counter, one per owner *per product*. Mutated
 * only by an atomic conditional `$inc`, which is what makes concurrent spending
 * race-safe; the ledger below is the immutable journal explaining every change.
 */
export interface WalletBalanceDoc {
  /** `${ownerId}:${product}` — product isolation enforced by the primary key. */
  _id: string;
  ownerId: string;
  product: WalletProduct;
  balance: number;
  updatedAt: Date;
}

export type WalletLedgerKind =
  | "purchase"
  | "deduct"
  | "bonus"
  | "refund"
  | "expiry";

/**
 * Append-only credit accounting. Never mutated. This is the spend
 * circuit-breaker: a drained balance stops all metered requests.
 */
export interface WalletLedgerDoc {
  _id?: ObjectId;
  ownerId: string;
  product: WalletProduct;
  /** Signed: positive credits, negative debits. */
  delta: number;
  kind: WalletLedgerKind;
  balanceAfter: number;
  /** The chatbot or form this row relates to. */
  subjectId: string | null;
  /** The message or submission a debit paid for. */
  refId: string | null;
  /** Set on `purchase` rows so a daily job can expire unused packs. */
  expiresAt: Date | null;
  note: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Forms SaaS
// ---------------------------------------------------------------------------

/**
 * The field types a customer may put on a form.
 *
 * Deliberately closed: submissions are validated against this set and rendered
 * by the widget, so an unknown type can never reach either. Extend the union,
 * the builder in `src/lib/forms/fields.ts`, and the renderer together.
 */
export type FormFieldType =
  | "text"
  | "email"
  | "textarea"
  | "select"
  | "checkbox"
  | "number"
  | "phone"
  | "hidden";

export interface FormField {
  id: string;
  type: FormFieldType;
  /** Submission key. Unique within a form. */
  name: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  /** Choices for `select`; empty for every other type. */
  options: string[];
  maxLength: number | null;
}

export interface FormAppearance {
  theme: "light" | "dark" | "auto";
  primaryColor: string;
  buttonText: string;
}

export type FormStatus = "active" | "paused";

export interface FormDoc extends Timestamped {
  _id?: ObjectId;
  formId: string;
  ownerId: string;
  name: string;
  description: string | null;
  status: FormStatus;
  /** Domains the embed may post from. Supports `*.company.com` wildcards. */
  allowedDomains: string[];
  /** Array order is display order. */
  fields: FormField[];
  appearance: FormAppearance;
  /** SHA-256 of the public embed token. The token itself is never stored. */
  publicTokenHash: string;
  /** Where new submissions are emailed. */
  notifyEmails: string[];
  honeypotEnabled: boolean;
  redirectUrl: string | null;
  thankYouMessage: string;
  submissionCount: number;
}

export type FormSubmissionStatus = "new" | "spam" | "archived";

export interface FormSubmissionDoc {
  _id?: ObjectId;
  submissionId: string;
  formId: string;
  ownerId: string;
  /** Validated against the form's field definitions. Never rendered as HTML. */
  data: Record<string, string | number | boolean | string[]>;
  meta: {
    /** Hashed so a database leak does not expose visitor IP addresses. */
    ipHash: string | null;
    userAgent: string | null;
    referrer: string | null;
    origin: string | null;
  };
  status: FormSubmissionStatus;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export type BillingGateway = "manual" | "razorpay";

export type BillingOrderStatus = "pending" | "paid" | "failed" | "cancelled";

export interface BillingOrderDoc extends Timestamped {
  _id?: ObjectId;
  orderId: string;
  ownerId: string;
  product: WalletProduct;
  packId: string;
  /** Credits granted once paid. */
  credits: number;
  /** Minor units (paise/cents) to avoid floating-point money. */
  amount: number;
  currency: string;
  gateway: BillingGateway;
  gatewayOrderId: string | null;
  status: BillingOrderStatus;
  paidAt: Date | null;
}

/**
 * Processed gateway events, for webhook idempotency. A unique index on
 * `{gateway, eventId}` makes a duplicate delivery a no-op insert rather than a
 * second credit — the same guarantee the job queue gets from its idempotency
 * key.
 */
export interface BillingEventDoc {
  _id?: ObjectId;
  gateway: BillingGateway;
  eventId: string;
  orderId: string | null;
  processedAt: Date;
}
