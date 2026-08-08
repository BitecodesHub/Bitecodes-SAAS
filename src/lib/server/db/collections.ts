import "server-only";

import type { Collection } from "mongodb";
import { getDatabase } from "@/lib/server/mongodb";
import { COLLECTIONS } from "@/lib/server/db/schema";
import type {
  AdminSessionDoc,
  AdminTokenDoc,
  AdminUserDoc,
  AnalyticsEventDoc,
  AuditLogDoc,
  AuditReportDoc,
  AutopilotPresetDoc,
  ChatbotApiKeyDoc,
  ChatbotDoc,
  ChatbotModelDoc,
  BillingEventDoc,
  BillingOrderDoc,
  BookingConfigDoc,
  BookingDoc,
  FormDoc,
  FormSubmissionDoc,
  KnowledgeChunkDoc,
  KnowledgeSourceDoc,
  WalletBalanceDoc,
  WalletLedgerDoc,
  BlogPostDoc,
  BlogRevisionDoc,
  ChatConversationDoc,
  ChatKnowledgeDoc,
  ConsultantRequestDoc,
  ContactEnquiryDoc,
  DiscoveryCacheDoc,
  EmailMessageDoc,
  EmailSequenceDoc,
  EmailTemplateDoc,
  JobDoc,
  MeetingDoc,
  NewsletterSubscriberDoc,
  PortalSessionDoc,
  ProjectDoc,
  ProspectDoc,
  ProspectSearchDoc,
  RateLimitDoc,
  SequenceEnrollmentDoc,
  SiteSettingsDoc,
  SuppressionDoc,
} from "@/lib/server/db/types";

/**
 * Typed collection accessors.
 *
 * Always reach for these rather than `database.collection("name")` — they
 * bind the document interface, so a typo in a field name is a build error
 * instead of a silent `undefined` at runtime.
 */

async function collection<T extends object>(
  name: string,
): Promise<Collection<T>> {
  const database = await getDatabase();
  return database.collection<T>(name);
}

export const contactEnquiries = () =>
  collection<ContactEnquiryDoc>(COLLECTIONS.contactEnquiries);
export const consultantRequests = () =>
  collection<ConsultantRequestDoc>(COLLECTIONS.consultantRequests);
export const auditReports = () =>
  collection<AuditReportDoc>(COLLECTIONS.auditReports);

export const adminUsers = () =>
  collection<AdminUserDoc>(COLLECTIONS.adminUsers);
export const adminSessions = () =>
  collection<AdminSessionDoc>(COLLECTIONS.adminSessions);
export const adminTokens = () =>
  collection<AdminTokenDoc>(COLLECTIONS.adminTokens);
export const auditLogEntries = () =>
  collection<AuditLogDoc>(COLLECTIONS.auditLog);

export const rateLimits = () =>
  collection<RateLimitDoc>(COLLECTIONS.rateLimits);
export const jobs = () => collection<JobDoc>(COLLECTIONS.jobs);
export const discoveryCache = () =>
  collection<DiscoveryCacheDoc>(COLLECTIONS.discoveryCache);
export const siteSettings = () =>
  collection<SiteSettingsDoc>(COLLECTIONS.siteSettings);
export const analyticsEvents = () =>
  collection<AnalyticsEventDoc>(COLLECTIONS.analyticsEvents);

export const blogPostDocs = () =>
  collection<BlogPostDoc>(COLLECTIONS.blogPosts);
export const blogRevisions = () =>
  collection<BlogRevisionDoc>(COLLECTIONS.blogRevisions);

export const prospects = () => collection<ProspectDoc>(COLLECTIONS.prospects);
export const prospectSearches = () =>
  collection<ProspectSearchDoc>(COLLECTIONS.prospectSearches);
export const autopilotPresets = () =>
  collection<AutopilotPresetDoc>(COLLECTIONS.autopilotPresets);

export const emailTemplates = () =>
  collection<EmailTemplateDoc>(COLLECTIONS.emailTemplates);
export const emailMessages = () =>
  collection<EmailMessageDoc>(COLLECTIONS.emailMessages);
export const emailSequences = () =>
  collection<EmailSequenceDoc>(COLLECTIONS.emailSequences);
export const sequenceEnrollments = () =>
  collection<SequenceEnrollmentDoc>(COLLECTIONS.sequenceEnrollments);
export const suppressions = () =>
  collection<SuppressionDoc>(COLLECTIONS.suppressions);
export const newsletterSubscribers = () =>
  collection<NewsletterSubscriberDoc>(COLLECTIONS.newsletterSubscribers);

export const chatConversations = () =>
  collection<ChatConversationDoc>(COLLECTIONS.chatConversations);
export const chatKnowledge = () =>
  collection<ChatKnowledgeDoc>(COLLECTIONS.chatKnowledge);

export const projects = () => collection<ProjectDoc>(COLLECTIONS.projects);
export const meetings = () => collection<MeetingDoc>(COLLECTIONS.meetings);
export const portalSessions = () =>
  collection<PortalSessionDoc>(COLLECTIONS.portalSessions);

// AI Chatbot SaaS.
export const chatbots = () => collection<ChatbotDoc>(COLLECTIONS.chatbots);
export const chatbotKnowledgeSources = () =>
  collection<KnowledgeSourceDoc>(COLLECTIONS.chatbotKnowledgeSources);
export const chatbotKnowledgeChunks = () =>
  collection<KnowledgeChunkDoc>(COLLECTIONS.chatbotKnowledgeChunks);
export const chatbotApiKeys = () =>
  collection<ChatbotApiKeyDoc>(COLLECTIONS.chatbotApiKeys);
export const chatbotModels = () =>
  collection<ChatbotModelDoc>(COLLECTIONS.chatbotModels);
// Prepaid credits, shared by every metered product.
export const walletLedger = () =>
  collection<WalletLedgerDoc>(COLLECTIONS.walletLedger);
export const walletBalances = () =>
  collection<WalletBalanceDoc>(COLLECTIONS.walletBalances);

// Forms SaaS.
export const forms = () => collection<FormDoc>(COLLECTIONS.forms);
export const bookingConfigs = () =>
  collection<BookingConfigDoc>(COLLECTIONS.bookingConfigs);
export const bookings = () => collection<BookingDoc>(COLLECTIONS.bookings);
export const formSubmissions = () =>
  collection<FormSubmissionDoc>(COLLECTIONS.formSubmissions);

// Billing.
export const billingOrders = () =>
  collection<BillingOrderDoc>(COLLECTIONS.billingOrders);
export const billingEvents = () =>
  collection<BillingEventDoc>(COLLECTIONS.billingEvents);

/**
 * Round-trips a `ping` to the database. Used by the admin health panel, which
 * needs a real answer rather than "the module imported successfully".
 */
export async function pingDatabase(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const started = Date.now();
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
