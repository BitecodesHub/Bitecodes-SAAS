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
};

/**
 * Creates every declared index. Safe to call repeatedly — `createIndexes` is
 * idempotent for identical specs.
 *
 * Failures are logged and swallowed on purpose. A unique index that cannot be
 * built (for example because legacy documents contain duplicates) must not
 * take the public website down; the affected query simply runs unindexed until
 * the data is fixed.
 */
export async function createDeclaredIndexes(database: Db): Promise<void> {
  await Promise.all(
    Object.entries(INDEXES).map(async ([collection, specs]) => {
      try {
        await database.collection(collection).createIndexes(specs);
      } catch (error) {
        console.error(
          `[db] Failed to create indexes for ${collection}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }),
  );
}
