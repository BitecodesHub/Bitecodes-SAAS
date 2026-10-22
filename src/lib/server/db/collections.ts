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
  DesktopProviderDoc,
  DesktopTokenDoc,
  DesktopPromptLogDoc,
  DesktopEventDoc,
  DesktopUsageDailyDoc,
  DesktopAlertDoc,
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
  SystemStateDoc,
} from "@/lib/server/db/types";

/*
  Growth engine type imports, one block per owning package so parallel edits
  merge cleanly. Edit only your own block.
*/
// ===== growth:foundation =====
import type { AiAutomationRunDoc } from "@/lib/server/db/types";
// ===== end growth:foundation =====

// ===== growth:analytics =====
import type { AnalyticsDailyDoc } from "@/lib/server/db/types";
// ===== end growth:analytics =====

// ===== growth:leads-crm =====
import type { LeadActivityDoc } from "@/lib/server/db/types";
// ===== end growth:leads-crm =====

// ===== growth:sales =====
import type { ProposalDoc } from "@/lib/server/db/types";
// ===== end growth:sales =====

// ===== growth:assistant-calls =====
import type { CallDoc } from "@/lib/server/db/types";
// ===== end growth:assistant-calls =====

// ===== growth:content-engine =====
import type { NewsletterIssueDoc, SocialDraftDoc } from "@/lib/server/db/types";
// ===== end growth:content-engine =====

// ===== growth:lifecycle =====
import type {
  CustomerReportDoc,
  LifecycleEventDoc,
} from "@/lib/server/db/types";
// ===== end growth:lifecycle =====

// ===== growth:loyalty =====
import type {
  ChurnRiskDoc,
  FeedbackDoc,
  ReferralDoc,
  TestimonialDoc,
} from "@/lib/server/db/types";
// ===== end growth:loyalty =====

// ===== growth:seo-tech =====
import type { SeoAuditDoc, SearchSubmissionDoc } from "@/lib/server/db/types";
// ===== end growth:seo-tech =====

// ===== growth:magnets =====
import type { LeadMagnetRequestDoc } from "@/lib/server/db/types";
// ===== end growth:magnets =====

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
export const systemState = () =>
  collection<SystemStateDoc>(COLLECTIONS.systemState);
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

export const desktopProviders = () =>
  collection<DesktopProviderDoc>(COLLECTIONS.desktopProviders);
export const desktopTokens = () =>
  collection<DesktopTokenDoc>(COLLECTIONS.desktopTokens);
export const desktopPromptLog = () =>
  collection<DesktopPromptLogDoc>(COLLECTIONS.desktopPromptLog);
export const desktopEvents = () =>
  collection<DesktopEventDoc>(COLLECTIONS.desktopEvents);
export const desktopUsageDaily = () =>
  collection<DesktopUsageDailyDoc>(COLLECTIONS.desktopUsageDaily);
export const desktopAlerts = () =>
  collection<DesktopAlertDoc>(COLLECTIONS.desktopAlerts);

/*
  Growth engine accessors. One section per owning package; edit only your own.
*/

// ===== growth:foundation =====
export const aiAutomationRuns = () =>
  collection<AiAutomationRunDoc>(COLLECTIONS.aiAutomationRuns);
// ===== end growth:foundation =====

// ===== growth:analytics =====
export const analyticsDaily = () =>
  collection<AnalyticsDailyDoc>(COLLECTIONS.analyticsDaily);
// ===== end growth:analytics =====

// ===== growth:leads-crm =====
export const leadActivities = () =>
  collection<LeadActivityDoc>(COLLECTIONS.leadActivities);
// ===== end growth:leads-crm =====

// ===== growth:sales =====
export const proposals = () => collection<ProposalDoc>(COLLECTIONS.proposals);
// ===== end growth:sales =====

// ===== growth:assistant-calls =====
export const calls = () => collection<CallDoc>(COLLECTIONS.calls);
// ===== end growth:assistant-calls =====

// ===== growth:content-engine =====
export const socialDrafts = () =>
  collection<SocialDraftDoc>(COLLECTIONS.socialDrafts);
export const newsletterIssues = () =>
  collection<NewsletterIssueDoc>(COLLECTIONS.newsletterIssues);
// ===== end growth:content-engine =====

// ===== growth:lifecycle =====
export const customerReports = () =>
  collection<CustomerReportDoc>(COLLECTIONS.customerReports);
export const lifecycleEvents = () =>
  collection<LifecycleEventDoc>(COLLECTIONS.lifecycleEvents);
// ===== end growth:lifecycle =====

// ===== growth:loyalty =====
export const feedback = () => collection<FeedbackDoc>(COLLECTIONS.feedback);
export const testimonials = () =>
  collection<TestimonialDoc>(COLLECTIONS.testimonials);
export const referrals = () => collection<ReferralDoc>(COLLECTIONS.referrals);
export const churnRisk = () => collection<ChurnRiskDoc>(COLLECTIONS.churnRisk);
// ===== end growth:loyalty =====

// ===== growth:seo-tech =====
export const seoAudits = () => collection<SeoAuditDoc>(COLLECTIONS.seoAudits);
export const searchSubmissions = () =>
  collection<SearchSubmissionDoc>(COLLECTIONS.searchSubmissions);
// ===== end growth:seo-tech =====

// ===== growth:magnets =====
export const leadMagnetRequests = () =>
  collection<LeadMagnetRequestDoc>(COLLECTIONS.leadMagnetRequests);
// ===== end growth:magnets =====

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
