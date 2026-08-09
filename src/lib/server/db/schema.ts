import "server-only";

import type { Db, IndexDescription } from "mongodb";

/**
 * Collection names and their indexes — the one place both are declared.
 *
 * Kept free of any database-connection import so `mongodb.ts` can depend on
 * it without a cycle (`collections.ts` depends on both).
 */
export const COLLECTIONS = {
  contactEnquiries: "contact_enquiries",
  consultantRequests: "consultant_requests",
  auditReports: "audit_reports",
  adminUsers: "admin_users",
  adminSessions: "admin_sessions",
  adminTokens: "admin_tokens",
  auditLog: "audit_log",
  rateLimits: "rate_limits",
  jobs: "jobs",
  discoveryCache: "discovery_cache",
  siteSettings: "site_settings",
  analyticsEvents: "analytics_events",
  blogPosts: "blog_posts",
  blogRevisions: "blog_revisions",
  prospects: "prospects",
  prospectSearches: "prospect_searches",
  autopilotPresets: "autopilot_presets",
  emailTemplates: "email_templates",
  emailMessages: "email_messages",
  emailSequences: "email_sequences",
  sequenceEnrollments: "sequence_enrollments",
  suppressions: "suppressions",
  newsletterSubscribers: "newsletter_subscribers",
  chatConversations: "chat_conversations",
  chatKnowledge: "chat_knowledge",
  projects: "projects",
  meetings: "meetings",
  portalSessions: "portal_sessions",
  // AI Chatbot SaaS
  chatbots: "chatbots",
  chatbotKnowledgeSources: "chatbot_knowledge_sources",
  chatbotKnowledgeChunks: "chatbot_knowledge_chunks",
  chatbotApiKeys: "chatbot_api_keys",
  chatbotModels: "chatbot_models",
  // Prepaid credits, shared by every metered product (chatbot, forms).
  walletLedger: "wallet_ledger",
  walletBalances: "wallet_balances",
  // Forms SaaS
  forms: "forms",
  formSubmissions: "form_submissions",
  bookingConfigs: "booking_configs",
  bookings: "bookings",
  // Billing
  billingOrders: "billing_orders",
  billingEvents: "billing_events",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

const DAY_SECONDS = 60 * 60 * 24;

/**
 * Index definitions per collection.
 *
 * Every index here backs a query the application actually makes; the comment
 * on each group names that query so an unused index is easy to spot later.
 * `expiresAt` TTL indexes use `expireAfterSeconds: 0`, which deletes a
 * document once its own `expiresAt` timestamp passes.
 */
export const INDEXES: Record<string, IndexDescription[]> = {
  // Inbound enquiries: admin list, dedupe by requestId, per-email history.
  [COLLECTIONS.contactEnquiries]: [
    { key: { createdAt: -1 } },
    { key: { email: 1, createdAt: -1 } },
    { key: { requestId: 1 }, unique: true },
    { key: { status: 1, createdAt: -1 } },
    { key: { assignedToId: 1, createdAt: -1 } },
  ],
  [COLLECTIONS.consultantRequests]: [
    { key: { requestId: 1 }, unique: true },
    { key: { createdAt: -1 } },
    { key: { email: 1, createdAt: -1 } },
    { key: { status: 1, createdAt: -1 } },
  ],
  [COLLECTIONS.auditReports]: [
    { key: { requestId: 1 }, unique: true },
    { key: { createdAt: -1 } },
    { key: { hostname: 1, createdAt: -1 } },
    // Sparse: only reports with a shareable link carry a shareId.
    { key: { shareId: 1 }, unique: true, sparse: true },
  ],

  // Admin identity: login by email, session lookup by token hash.
  [COLLECTIONS.adminUsers]: [
    { key: { email: 1 }, unique: true },
    { key: { role: 1 } },
    /*
      One Google identity may own at most one account.

      Partial rather than sparse: a sparse unique index still indexes documents
      whose field is explicitly `null`, so the second account to be written with
      `googleSub: null` — every password-only account — would collide with the
      first. The partial filter takes only the documents that actually carry a
      string, which is the set the uniqueness is about.
    */
    {
      key: { googleSub: 1 },
      unique: true,
      partialFilterExpression: { googleSub: { $type: "string" } },
    },
  ],
  [COLLECTIONS.adminSessions]: [
    { key: { tokenHash: 1 }, unique: true },
    { key: { userId: 1, createdAt: -1 } },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  [COLLECTIONS.adminTokens]: [
    { key: { tokenHash: 1 }, unique: true },
    { key: { userId: 1, purpose: 1 } },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  [COLLECTIONS.auditLog]: [
    { key: { createdAt: -1 } },
    { key: { actorId: 1, createdAt: -1 } },
    { key: { action: 1, createdAt: -1 } },
  ],

  // Infrastructure.
  [COLLECTIONS.rateLimits]: [{ key: { expiresAt: 1 }, expireAfterSeconds: 0 }],
  [COLLECTIONS.jobs]: [
    // The worker's claim query: queued jobs due now, oldest first.
    { key: { status: 1, runAt: 1 } },
    { key: { type: 1, status: 1 } },
    { key: { idempotencyKey: 1 }, unique: true, sparse: true },
    { key: { createdAt: -1 } },
    { key: { lockedUntil: 1 } },
  ],
  [COLLECTIONS.discoveryCache]: [
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  [COLLECTIONS.analyticsEvents]: [
    { key: { createdAt: -1 } },
    { key: { type: 1, createdAt: -1 } },
    { key: { path: 1, createdAt: -1 } },
    // Raw events are only needed for rolling reports; drop after 180 days.
    { key: { createdAt: 1 }, expireAfterSeconds: 180 * DAY_SECONDS },
  ],

  // Blog.
  [COLLECTIONS.blogPosts]: [
    { key: { slug: 1 }, unique: true },
    { key: { status: 1, publishedAt: -1 } },
    { key: { category: 1, publishedAt: -1 } },
    { key: { tags: 1 } },
    // Scans for posts whose scheduled publish time has arrived.
    { key: { status: 1, scheduledFor: 1 } },
  ],
  [COLLECTIONS.blogRevisions]: [
    { key: { postId: 1, revision: -1 }, unique: true },
    { key: { createdAt: -1 } },
  ],

  // Prospecting.
  [COLLECTIONS.prospects]: [
    // Provider identity — the primary dedupe guard on re-running a search.
    { key: { source: 1, sourceId: 1 }, unique: true },
    // Cross-provider dedupe (same business found via OSM and Google).
    { key: { dedupeKey: 1 } },
    { key: { status: 1, updatedAt: -1 } },
    { key: { "classification.primaryTag": 1, "classification.score": -1 } },
    { key: { city: 1, status: 1 } },
    { key: { email: 1 }, sparse: true },
    { key: { searchId: 1 } },
    // Bounding-box queries for the admin map view.
    { key: { lat: 1, lng: 1 } },
  ],
  [COLLECTIONS.prospectSearches]: [
    { key: { searchId: 1 }, unique: true },
    { key: { createdAt: -1 } },
  ],
  [COLLECTIONS.autopilotPresets]: [
    { key: { presetId: 1 }, unique: true },
    // The tick's due-preset query: enabled presets, least-recently run first.
    { key: { enabled: 1, lastRunAt: 1 } },
  ],

  // Email engine.
  [COLLECTIONS.emailTemplates]: [
    { key: { key: 1 }, unique: true },
    { key: { category: 1 } },
    { key: { prospectTag: 1 }, sparse: true },
  ],
  [COLLECTIONS.emailMessages]: [
    { key: { messageId: 1 }, unique: true },
    { key: { trackingId: 1 }, unique: true },
    // The send worker's claim query.
    { key: { status: 1, sendAfter: 1 } },
    { key: { prospectId: 1, createdAt: -1 } },
    { key: { to: 1, createdAt: -1 } },
    { key: { sentAt: -1 } },
    { key: { createdAt: -1 } },
  ],
  [COLLECTIONS.emailSequences]: [{ key: { key: 1 }, unique: true }],
  [COLLECTIONS.sequenceEnrollments]: [
    { key: { enrollmentId: 1 }, unique: true },
    { key: { status: 1, nextRunAt: 1 } },
    { key: { prospectId: 1 }, sparse: true },
    { key: { email: 1 } },
  ],
  [COLLECTIONS.suppressions]: [{ key: { value: 1 }, unique: true }],
  [COLLECTIONS.newsletterSubscribers]: [
    { key: { email: 1 }, unique: true },
    { key: { status: 1, createdAt: -1 } },
  ],

  // Chat.
  [COLLECTIONS.chatConversations]: [
    { key: { conversationId: 1 }, unique: true },
    { key: { lastMessageAt: -1 } },
    { key: { hasUnanswered: 1, lastMessageAt: -1 } },
  ],
  [COLLECTIONS.chatKnowledge]: [
    { key: { enabled: 1 } },
    { key: { createdAt: -1 } },
  ],

  // Client onboarding and portal.
  [COLLECTIONS.projects]: [
    { key: { projectId: 1 }, unique: true },
    { key: { clientEmail: 1 } },
    { key: { status: 1, updatedAt: -1 } },
  ],
  [COLLECTIONS.meetings]: [
    { key: { meetingId: 1 }, unique: true },
    { key: { startsAt: 1 } },
    { key: { email: 1 } },
  ],
  [COLLECTIONS.portalSessions]: [
    { key: { tokenHash: 1 }, unique: true },
    { key: { projectId: 1 } },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],

  // AI Chatbot SaaS.
  [COLLECTIONS.chatbots]: [
    { key: { chatbotId: 1 }, unique: true },
    { key: { ownerId: 1, createdAt: -1 } },
    // Widget auth looks a bot up by its public token hash.
    { key: { publicTokenHash: 1 }, unique: true },
  ],
  [COLLECTIONS.chatbotKnowledgeSources]: [
    { key: { chatbotId: 1, createdAt: -1 } },
    { key: { ownerId: 1 } },
    { key: { status: 1 } },
  ],
  [COLLECTIONS.chatbotKnowledgeChunks]: [
    { key: { chatbotId: 1, sourceId: 1, ord: 1 } },
    { key: { sourceId: 1 } },
    { key: { ownerId: 1 } },
    // NB: the vector index on `embedding` is an Atlas Search index, created in
    // the Atlas UI/API, not here (createIndexes cannot declare $vectorSearch).
  ],
  [COLLECTIONS.chatbotApiKeys]: [
    { key: { keyHash: 1 }, unique: true },
    { key: { ownerId: 1, createdAt: -1 } },
  ],
  [COLLECTIONS.chatbotModels]: [{ key: { key: 1 }, unique: true }],
  [COLLECTIONS.walletLedger]: [
    // The usage/billing history read: one owner's rows for one product.
    { key: { ownerId: 1, product: 1, createdAt: -1 } },
    { key: { refId: 1 }, sparse: true },
  ],
  // `_id` is `${ownerId}:${product}`, already unique — no extra index needed.
  [COLLECTIONS.walletBalances]: [],

  // Forms SaaS.
  [COLLECTIONS.forms]: [
    { key: { formId: 1 }, unique: true },
    { key: { ownerId: 1, createdAt: -1 } },
    // The public embed path looks a form up by its token hash.
    { key: { publicTokenHash: 1 }, unique: true },
  ],
  [COLLECTIONS.bookingConfigs]: [
    { key: { bookingId: 1 }, unique: true },
    { key: { ownerId: 1, createdAt: -1 } },
    // The public embed path looks a config up by its token hash.
    { key: { publicTokenHash: 1 }, unique: true },
  ],
  [COLLECTIONS.bookings]: [
    { key: { bookingId: 1 }, unique: true },
    { key: { ownerId: 1, startAt: -1 } },
    // Listing a config's diary, and computing which slots are already taken.
    { key: { configId: 1, startAt: 1 } },
    /**
     * The double-booking guard, and the reason this is an index rather than a
     * check in application code.
     *
     * Two visitors racing for the last slot both read "free" before either
     * writes, so a read-then-write cannot prevent it at any isolation level this
     * deployment runs at. Making (configId, startAt) unique means the database
     * decides: one insert succeeds, the other gets a duplicate-key error the
     * caller turns into "that time was just taken".
     *
     * Partial, on confirmed bookings only, so cancelling a slot frees it for
     * someone else instead of poisoning that time forever.
     */
    {
      key: { configId: 1, startAt: 1, status: 1 },
      unique: true,
      partialFilterExpression: { status: "confirmed" },
    },
  ],
  [COLLECTIONS.formSubmissions]: [
    { key: { submissionId: 1 }, unique: true },
    { key: { formId: 1, createdAt: -1 } },
    { key: { ownerId: 1, createdAt: -1 } },
    { key: { formId: 1, status: 1, createdAt: -1 } },
  ],

  // Billing.
  [COLLECTIONS.billingOrders]: [
    { key: { orderId: 1 }, unique: true },
    { key: { ownerId: 1, createdAt: -1 } },
    { key: { gateway: 1, gatewayOrderId: 1 }, sparse: true },
  ],
  [COLLECTIONS.billingEvents]: [
    // The idempotency guard: a duplicate webhook delivery cannot insert twice.
    { key: { gateway: 1, eventId: 1 }, unique: true },
  ],
};

/**
 * Creates every declared index. Safe to call repeatedly — `createIndexes` is
 * idempotent for identical specs.
 *
 * Failures are logged and swallowed on purpose. A unique index that cannot be
 * built (for example because legacy documents contain duplicates) must not
 * take the public website down; the affected query simply runs unindexed until
 * the data is fixed.
 *
 * With `awaitNonUnique: false` the caller waits only for indexes whose absence
 * would be a *correctness* problem, and the remainder are built in the
 * background. See the note in `mongodb.ts` for why that split is drawn where it
 * is. The background work is deliberately detached rather than dangling: any
 * rejection is caught, because an unhandled promise rejection would take the
 * whole serverless invocation down.
 */
export async function createDeclaredIndexes(
  database: Db,
  options: { awaitNonUnique?: boolean } = {},
): Promise<void> {
  const { awaitNonUnique = true } = options;

  const build = async (collection: string, specs: IndexDescription[]) => {
    if (specs.length === 0) return;
    try {
      await database.collection(collection).createIndexes(specs);
    } catch (error) {
      console.error(
        `[db] Failed to create indexes for ${collection}:`,
        error instanceof Error ? error.message : error,
      );
    }
  };

  const blocking: Promise<void>[] = [];
  const background: Promise<void>[] = [];

  for (const [collection, specs] of Object.entries(INDEXES)) {
    if (awaitNonUnique) {
      blocking.push(build(collection, specs));
      continue;
    }
    const unique = specs.filter((spec) => spec.unique);
    const rest = specs.filter((spec) => !spec.unique);
    if (unique.length) blocking.push(build(collection, unique));
    if (rest.length) background.push(build(collection, rest));
  }

  // Detached, but never unhandled.
  void Promise.all(background).catch(() => undefined);
  await Promise.all(blocking);
}
