import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { assertCapability } from "@/lib/server/auth/dal";
import { can } from "@/lib/server/auth/roles";
import { getChatbot, listChatbots } from "@/lib/server/chatbot/repository";
import {
  getForm,
  listForms,
  listSubmissions,
} from "@/lib/server/forms/repository";
import {
  getBookingConfig,
  listBookingConfigs,
  listBookings,
} from "@/lib/server/bookings/repository";
import { listSources } from "@/lib/server/knowledge/repository";
import { listEnabledModels } from "@/lib/server/chatbot/models";
import { getBalance } from "@/lib/server/wallet/wallet";
import { walletLedger } from "@/lib/server/db/collections";
import { getActiveProvider } from "@/lib/server/billing/orders";
import {
  formatPackPrice,
  packsFor,
  perUnitPrice,
} from "@/lib/server/billing/packs";
import { siteConfig } from "@/lib/site";
import type { WalletProduct } from "@/lib/server/db/types";
import { ChatbotManager } from "@/components/admin/chatbot-manager";
import { ChatbotSettings } from "@/components/admin/chatbot-settings";
import { ChatbotAppearanceEditor } from "@/components/admin/chatbot-appearance";
import {
  ChatbotUsage,
  type ChatbotUsageRow,
} from "@/components/admin/chatbot-usage";
import { KnowledgeManager } from "@/components/admin/knowledge-manager";
import { FormsManager } from "@/components/admin/forms-manager";
import { FormBuilder } from "@/components/admin/form-builder";
import { FormSettings } from "@/components/admin/form-settings";
import { FormSubmissions } from "@/components/admin/form-submissions";
import { BookingsManager } from "@/components/admin/bookings-manager";
import { BookingDiary, type DiaryRow } from "@/components/admin/booking-diary";
import {
  BookingSettings,
  type BookingSettingsInitial,
} from "@/components/admin/booking-settings";
import { CreditsPanel } from "@/components/admin/credits-panel";
import { ApiKeysManager } from "@/components/account/api-keys-manager";
import { listApiKeys } from "@/lib/server/chatbot/api-keys";
import { Badge } from "@/components/ui/badge";

/**
 * The product screens, rendered by both signed-in areas.
 *
 * `/admin/chatbots` and `/app/chatbots` show the same thing to the same query,
 * because they *are* the same thing: a person managing the chatbots they own.
 * Only the surrounding shell and the link back differ, so only that is a prop.
 *
 * Written as one module of async Server Components rather than as two parallel
 * sets of pages. Two sets would compile and pass review, and then one of them
 * would get a fix the other did not — and the copy that goes stale is the
 * customer's, because we look at ours every day.
 *
 * Authorisation is unchanged and unconditional: each screen asserts its own
 * capability, and every query is scoped by `ownerId` in the query itself. A
 * screen cannot be made to show another tenant's records by rendering it from a
 * different route.
 */

/** Where the screen lives, so "all chatbots" points back to the right list. */
export interface ScreenProps {
  basePath: "/admin" | "/app";
}

function packCards(product: WalletProduct) {
  return packsFor(product).map((pack) => ({
    packId: pack.packId,
    label: pack.label,
    credits: pack.credits,
    price: formatPackPrice(pack),
    perUnit: perUnitPrice(pack),
    blurb: pack.blurb,
    popular: Boolean(pack.popular),
  }));
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
    >
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Chatbots
// ---------------------------------------------------------------------------

export async function ChatbotsScreen({ basePath }: ScreenProps) {
  const session = await assertCapability("manage_chatbots");
  const [bots, tokens] = await Promise.all([
    listChatbots(session.userId),
    getBalance(session.userId, "chatbot"),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Chatbots</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Create an embeddable AI chatbot, set the domains it may run on, and
            copy its one-line snippet. Open a bot to add its knowledge base —
            see the product page at{" "}
            <Link
              href="/ai-chatbot"
              className="text-primary underline-offset-2 hover:underline"
            >
              /ai-chatbot
            </Link>
            .
          </p>
        </div>
        {/* The model catalogue holds provider API keys, so it is staff-only and
            is offered only to somebody who can actually open it. */}
        {can(session.role, "manage_settings") && (
          <Link
            href="/admin/chatbots/models"
            className="text-primary text-sm underline-offset-2 hover:underline"
          >
            Manage AI models →
          </Link>
        )}
      </header>

      <CreditsPanel
        product="chatbot"
        packs={packCards("chatbot")}
        balance={tokens}
        canGrant={can(session.role, "manage_settings")}
        gatewayLive={getActiveProvider().id !== "manual"}
      />

      <ChatbotManager
        basePath={basePath}
        siteUrl={siteConfig.url}
        chatbots={bots.map((b) => ({
          chatbotId: b.chatbotId,
          name: b.name,
          status: b.status,
          websiteName: b.websiteName,
          allowedDomains: b.allowedDomains,
        }))}
      />
    </div>
  );
}

/** Ledger rows read for the usage panel. Bounded so one busy bot cannot stall the page. */
const USAGE_ROW_LIMIT = 2_000;

export async function ChatbotDetailScreen({
  basePath,
  id,
}: ScreenProps & { id: string }) {
  const session = await assertCapability("manage_chatbots");

  // Issued together rather than in sequence. Every query is scoped to this owner,
  // so none can leak another tenant's data if the bot turns out not to exist —
  // the ownership check lives in the query, not in this ordering.
  const [bot, sources, models, balance, ledgerRows] = await Promise.all([
    getChatbot(session.userId, id),
    listSources(session.userId, id),
    listEnabledModels(),
    getBalance(session.userId, "chatbot"),
    walletLedger().then((collection) =>
      collection
        .find(
          { ownerId: session.userId, product: "chatbot", subjectId: id },
          {
            projection: {
              delta: 1,
              kind: 1,
              refId: 1,
              note: 1,
              createdAt: 1,
              _id: 0,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(USAGE_ROW_LIMIT)
        .toArray(),
    ),
  ]);

  if (!bot) notFound();

  // Dates are serialised here rather than in the component: a Server Component
  // may not hand a Date across the boundary to a client component.
  const usageRows: ChatbotUsageRow[] = ledgerRows.map((row) => ({
    delta: row.delta,
    kind: row.kind,
    refId: row.refId ?? null,
    note: row.note ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <BackLink href={`${basePath}/chatbots`} label="All chatbots" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{bot.name}</h1>
          <Badge variant={bot.status === "active" ? "secondary" : "muted"}>
            {bot.status}
          </Badge>
        </div>
        {bot.websiteName && (
          <p className="text-muted-foreground mt-1 text-sm">
            {bot.websiteName}
          </p>
        )}
      </div>

      <ChatbotUsage chatbotName={bot.name} rows={usageRows} balance={balance} />

      <ChatbotSettings
        chatbotId={bot.chatbotId}
        name={bot.name}
        description={bot.description}
        websiteName={bot.websiteName}
        allowedDomains={bot.allowedDomains}
        modelKey={bot.modelKey}
        systemPrompt={bot.systemPrompt}
        status={bot.status === "active" ? "active" : "paused"}
        // Only enabled models: offering one an operator cannot use would let them
        // pin a bot to a model the gateway will silently replace at answer time.
        models={models.map((model) => ({
          key: model.key,
          label: model.label,
          provider: model.provider,
        }))}
      />

      <ChatbotAppearanceEditor
        chatbotId={bot.chatbotId}
        appearance={bot.appearance}
      />

      <KnowledgeManager
        chatbotId={bot.chatbotId}
        sources={sources.map((source) => ({
          id: source.id,
          type: source.type,
          origin: source.origin,
          status: source.status,
          chunkCount: source.chunkCount,
          error: source.error,
          createdAt: source.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export async function FormsScreen({ basePath }: ScreenProps) {
  const session = await assertCapability("manage_forms");
  const [forms, credits] = await Promise.all([
    listForms(session.userId),
    getBalance(session.userId, "forms"),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Build a form, choose which domains may use it, and paste one line on
          any website. Submissions land here and are emailed to you — see the
          product page at{" "}
          <Link
            href="/forms"
            className="text-primary underline-offset-2 hover:underline"
          >
            /forms
          </Link>
          .
        </p>
      </header>

      <CreditsPanel
        product="forms"
        packs={packCards("forms")}
        balance={credits}
        canGrant={can(session.role, "manage_settings")}
        gatewayLive={getActiveProvider().id !== "manual"}
      />

      <FormsManager
        basePath={basePath}
        siteUrl={siteConfig.url}
        forms={forms.map((f) => ({
          formId: f.formId,
          name: f.name,
          status: f.status,
          allowedDomains: f.allowedDomains,
          submissionCount: f.submissionCount,
          fieldCount: f.fields.length,
        }))}
      />
    </div>
  );
}

export async function FormDetailScreen({
  basePath,
  id,
}: ScreenProps & { id: string }) {
  const session = await assertCapability("manage_forms");
  const form = await getForm(session.userId, id);
  if (!form) notFound();

  const [submissions, credits] = await Promise.all([
    listSubmissions(session.userId, id, { limit: 100 }),
    getBalance(session.userId, "forms"),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <BackLink href={`${basePath}/forms`} label="All forms" />
      </div>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {form.name}
          <Badge variant={form.status === "active" ? "secondary" : "muted"}>
            {form.status}
          </Badge>
        </h1>
        <p className="text-muted-foreground text-sm">
          {form.submissionCount} total submission
          {form.submissionCount === 1 ? "" : "s"} · {credits} credit
          {credits === 1 ? "" : "s"} remaining ·{" "}
          {form.allowedDomains.length
            ? `runs on ${form.allowedDomains.join(", ")}`
            : "no domains configured yet"}
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1 mb-4 max-w-2xl text-sm">
          Placed above the field builder because an unconfigured allowlist is
          the usual reason a freshly embedded form appears to do nothing.
        </p>
        {/* Only the plain, serialisable subset crosses to the client — the doc
            also carries the token hash and the owner id, which it must not. */}
        <FormSettings
          formId={form.formId}
          initial={{
            name: form.name,
            description: form.description,
            allowedDomains: form.allowedDomains,
            notifyEmails: form.notifyEmails,
            honeypotEnabled: form.honeypotEnabled,
            redirectUrl: form.redirectUrl,
            thankYouMessage: form.thankYouMessage,
            appearance: form.appearance,
          }}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Fields</h2>
        <p className="text-muted-foreground mt-1 mb-4 max-w-2xl text-sm">
          The field name is the key stored on each submission and used in the
          CSV export. Changing it does not rewrite past submissions.
        </p>
        <FormBuilder formId={form.formId} initialFields={form.fields} />
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Submissions</h2>
        <div className="mt-4">
          <FormSubmissions
            formId={form.formId}
            columns={form.fields.map((f) => f.name)}
            submissions={submissions.map((s) => ({
              submissionId: s.submissionId,
              createdAt: s.createdAt.toISOString(),
              status: s.status,
              data: s.data,
            }))}
          />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export async function BookingsScreen({ basePath }: ScreenProps) {
  const session = await assertCapability("manage_bookings");

  const [configs, credits] = await Promise.all([
    listBookingConfigs(session.userId),
    getBalance(session.userId, "bookings"),
  ]);

  /**
   * Upcoming counts, one query per calendar.
   *
   * A single aggregation would be fewer round trips, but it would also be the
   * only place in this slice that reaches past the repository into the
   * collection directly. An account has a handful of calendars, not thousands,
   * so the fan-out costs nothing worth having a second data path for.
   *
   * `from` is the current instant rather than the start of the day: a slot that
   * finished this morning is not upcoming, and counting it would make the number
   * beside the calendar disagree with the diary that is opened to check it.
   */
  const now = new Date();
  const upcoming = await Promise.all(
    configs.map(async (config) => {
      const rows = await listBookings(session.userId, config.bookingId, {
        from: now,
        limit: 500,
      });
      return rows.filter((row) => row.status === "confirmed").length;
    }),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Publish your availability, paste one line on any website, and let
          visitors pick a time. Slots are offered in the visitor&apos;s own
          timezone and land in the diary here.
        </p>
      </header>

      <CreditsPanel
        product="bookings"
        packs={packCards("bookings")}
        balance={credits}
        canGrant={can(session.role, "manage_settings")}
        gatewayLive={getActiveProvider().id !== "manual"}
      />

      {credits <= 0 && (
        <p className="text-sm text-amber-600">
          With no credits the widget still renders and still shows times — but
          every attempt to book is refused. Top up before you advertise the
          link.
        </p>
      )}

      <BookingsManager
        basePath={basePath}
        siteUrl={siteConfig.url}
        bookings={configs.map((config, index) => ({
          bookingId: config.bookingId,
          name: config.name,
          status: config.status,
          timezone: config.timezone,
          slotMinutes: config.slotMinutes,
          allowedDomains: config.allowedDomains,
          bookingCount: config.bookingCount,
          upcomingCount: upcoming[index] ?? 0,
        }))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email API
// ---------------------------------------------------------------------------

export async function EmailApiScreen() {
  const session = await assertCapability("manage_email");
  const [keys, credits] = await Promise.all([
    listApiKeys(session.userId),
    getBalance(session.userId, "email"),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Email API</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Send transactional email from your own application — password resets,
          receipts, confirmations, one-time codes. One credit per message
          accepted for delivery.
        </p>
      </header>

      <CreditsPanel
        product="email"
        packs={packCards("email")}
        balance={credits}
        canGrant={can(session.role, "manage_settings")}
        gatewayLive={getActiveProvider().id !== "manual"}
      />

      <ApiKeysManager
        keys={keys.map((key) => ({
          id: key._id?.toHexString() ?? "",
          name: key.name,
          prefix: key.prefix,
          scopes: key.scopes,
          status: key.status,
          lastUsedAtIso: key.lastUsedAt
            ? new Date(key.lastUsedAt).toISOString()
            : null,
          createdAtIso: new Date(key.createdAt).toISOString(),
        }))}
      />

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Sending a message</h2>
        <pre className="border-border bg-muted/40 mt-3 overflow-x-auto rounded-xl border p-4 text-xs leading-relaxed">
          {`curl -X POST ${siteConfig.url}/api/v1/email/send \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "customer@example.com",
    "subject": "Your receipt",
    "text": "Thanks for your order."
  }'`}
        </pre>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Transactional mail only: messages somebody is expecting because of
          something they just did. No newsletters, no campaigns, and nothing to
          a list. At most 10 recipients per request and 200 a day per key — the
          limits exist to keep the shared sending domain off blocklists, which
          protects everybody&apos;s delivery including yours.
        </p>
      </section>
    </div>
  );
}

/**
 * How far back the diary reaches.
 *
 * A booking that happened yesterday is still the thing an owner is most likely
 * to be looking for — "who was that, and what did they say" — so the diary opens
 * on a short window of recent history rather than only the future.
 */
const DIARY_LOOKBACK_DAYS = 7;
const DIARY_LIMIT = 300;

/**
 * The clock, read outside component scope.
 *
 * `Date.now()` called during a render is flagged as impure, and rightly: a
 * component that reads the clock while rendering is not idempotent. This screen
 * is rendered by `force-dynamic` pages and genuinely needs the current time, so
 * the read is done in a plain function the rule can see is not a component.
 */
function diaryWindow(): { from: Date; nowIso: string } {
  const now = new Date();
  return {
    from: new Date(now.getTime() - DIARY_LOOKBACK_DAYS * 86_400_000),
    nowIso: now.toISOString(),
  };
}

export async function BookingDetailScreen({
  basePath,
  id,
}: ScreenProps & { id: string }) {
  const session = await assertCapability("manage_bookings");
  const { from, nowIso } = diaryWindow();

  // Issued together. Each query is scoped to this owner in the query itself, so
  // the ordering carries no authorisation weight.
  const [config, diary, balance] = await Promise.all([
    getBookingConfig(session.userId, id),
    listBookings(session.userId, id, { from, limit: DIARY_LIMIT }),
    getBalance(session.userId, "bookings"),
  ]);

  if (!config) notFound();

  const initial: BookingSettingsInitial = {
    name: config.name,
    description: config.description,
    allowedDomains: config.allowedDomains,
    notifyEmails: config.notifyEmails,
    timezone: config.timezone,
    slotMinutes: config.slotMinutes,
    leadTimeHours: config.leadTimeHours,
    horizonDays: config.horizonDays,
    availability: config.availability,
    blackoutDates: config.blackoutDates,
    confirmationMessage: config.confirmationMessage,
    appearance: config.appearance,
  };

  // Dates are serialised here: a Server Component may not hand a Date across the
  // boundary into a client component.
  const rows: DiaryRow[] = diary.map((b) => ({
    bookingId: b.bookingId,
    startIso: new Date(b.startAt).toISOString(),
    endIso: new Date(b.endAt).toISOString(),
    status: b.status,
    customerName: b.customerName,
    customerEmail: b.customerEmail,
    customerPhone: b.customerPhone,
    notes: b.notes,
  }));

  const upcoming = rows.filter(
    (r) => r.status === "confirmed" && r.startIso >= nowIso,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <BackLink href={`${basePath}/bookings`} label="All calendars" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {config.name}
          </h1>
          <Badge variant={config.status === "active" ? "secondary" : "muted"}>
            {config.status}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {upcoming} upcoming {upcoming === 1 ? "booking" : "bookings"} ·{" "}
          {config.timezone} ·{" "}
          {balance > 0 ? (
            <>{balance.toLocaleString()} booking credits left</>
          ) : (
            // Stated plainly rather than left to be discovered by a customer
            // hitting a refusal: with no credits the calendar takes nothing.
            <span className="text-amber-600">
              No booking credits — new bookings will be turned away
            </span>
          )}
        </p>
      </div>

      <BookingDiary bookings={rows} timezone={config.timezone} />

      <BookingSettings bookingId={config.bookingId} initial={initial} />
    </div>
  );
}
