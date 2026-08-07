import { Bot, Coins } from "lucide-react";
import { BarChart, StatTile } from "@/components/ui/chart";
import { formatCompact } from "@/lib/chart";
import { cn } from "@/lib/utils";

/**
 * Per-chatbot usage panel: what one bot has cost, and whether it is answering.
 *
 * WHAT THE PAGE MUST SUPPLY (for whoever wires this up):
 *
 *   <ChatbotUsage
 *     chatbotName={bot.name}
 *     rows={ledger.map((row) => ({
 *       delta: row.delta,
 *       kind: row.kind,
 *       refId: row.refId,
 *       note: row.note,
 *       createdAt: row.createdAt.toISOString(),
 *     }))}
 *     balance={walletBalance}   // optional
 *   />
 *
 * `rows` must ALREADY be filtered to `product === "chatbot"` and
 * `subjectId === bot.chatbotId`, and must be this owner's rows. This component
 * is presentational: it never queries, and it has no way to tell whose ledger it
 * was handed, so the scoping and the ownership check stay in the page. Pass the
 * whole retained history if you have it — the trailing window is cut here, and
 * rows older than the window are what make the "vs previous period" delta real
 * rather than invented.
 *
 * `createdAt` is an ISO string, not a Date, and every bucket below is keyed off
 * its UTC date prefix. Deliberate: bucketing through the local `Date` calendar
 * would put the server and the browser in different days and desynchronise the
 * markup on hydration.
 *
 * No "use client": there is no state and no handler here, so the panel renders
 * on the server and only the chart primitives it composes ship to the browser.
 */

/** One wallet ledger row, narrowed to the fields this panel reads. */
export interface ChatbotUsageRow {
  /** Signed, as stored: negative is spend, positive is a credit or refund. */
  delta: number;
  kind: "purchase" | "deduct" | "bonus" | "refund" | "expiry";
  /** The conversation a debit paid for. Null on rows the gateway could not attribute. */
  refId: string | null;
  /** Records the model as `chat:<modelKey>`; the per-model split is derived from it. */
  note: string | null;
  /** ISO 8601, e.g. "2026-08-07T09:14:02.511Z". */
  createdAt: string;
}

export interface ChatbotUsageProps {
  chatbotName: string;
  rows: ChatbotUsageRow[];
  /**
   * Chat token balance for the whole account. Optional, and labelled as
   * account-wide — it is not this bot's own allowance.
   */
  balance?: number;
  /** Length of the trailing window, in days. */
  days?: number;
  /**
   * ISO instant the window ends at, normally "now". Omit and the window ends on
   * the last day this bot actually spent, which keeps the chart deterministic
   * without a clock read during render.
   */
  periodEndIso?: string;
  className?: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAY_MS = 86_400_000;

/** `"2026-08-07T09:14:02.511Z"` → `"2026-08-07"`. */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(key: string): string {
  const [, month, day] = key.split("-");
  const index = Number(month) - 1;
  return `${Number(day)} ${MONTHS[index] ?? month}`;
}

function shiftDay(key: string, offset: number): string {
  return new Date(Date.parse(`${key}T00:00:00.000Z`) + offset * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** `chat:<modelKey>`. Anything else is a row we must not attribute to a model. */
const MODEL_NOTE = /^chat:(.+)$/;
const UNRECORDED_MODEL = "Model not recorded";

export function ChatbotUsage({
  chatbotName,
  rows,
  balance,
  days = 14,
  periodEndIso,
  className,
}: ChatbotUsageProps) {
  const windowDays = Math.min(Math.max(Math.trunc(days), 1), 90);

  // Only `deduct` rows are what the bot cost. Refunds and expiries move the same
  // wallet and would net the spend figure down into something an operator cannot
  // reconcile against their own logs, so they are reported separately.
  const spend = rows.filter((row) => row.kind === "deduct" && row.delta < 0);

  const totalTokens = spend.reduce((sum, row) => sum + -row.delta, 0);
  const refunded = rows
    .filter((row) => row.kind === "refund" && row.delta > 0)
    .reduce((sum, row) => sum + row.delta, 0);

  if (spend.length === 0) {
    return (
      <EmptyUsage
        chatbotName={chatbotName}
        balance={balance}
        className={className}
      />
    );
  }

  const spendDays = spend.map((row) => dayKey(row.createdAt)).sort();
  const endDay = dayKey(
    periodEndIso ?? `${spendDays[spendDays.length - 1]}T00:00:00Z`,
  );
  const axis = Array.from({ length: windowDays }, (_, index) =>
    shiftDay(endDay, index - (windowDays - 1)),
  );
  const startDay = axis[0]!;

  const tokensByDay = new Map<string, number>();
  // A conversation is billed once per message, so distinct `refId` is the
  // conversation count. Rows the gateway could not attribute are counted
  // individually rather than dropped: better to overstate by a message than to
  // quietly bill for traffic the panel does not show.
  const conversationsByDay = new Map<string, Set<string>>();
  const unattributedByDay = new Map<string, number>();
  const tokensByModel = new Map<string, number>();
  let priorTokens = 0;
  let hasPriorHistory = false;

  for (const row of spend) {
    const key = dayKey(row.createdAt);
    const tokens = -row.delta;

    if (key < startDay) {
      hasPriorHistory = true;
      // The equally long window immediately before this one.
      if (key >= shiftDay(startDay, -windowDays)) priorTokens += tokens;
      continue;
    }
    if (key > endDay) continue;

    tokensByDay.set(key, (tokensByDay.get(key) ?? 0) + tokens);
    if (row.refId) {
      const seen = conversationsByDay.get(key) ?? new Set<string>();
      seen.add(row.refId);
      conversationsByDay.set(key, seen);
    } else {
      unattributedByDay.set(key, (unattributedByDay.get(key) ?? 0) + 1);
    }

    const match = row.note ? MODEL_NOTE.exec(row.note) : null;
    const model = match?.[1]?.trim() || UNRECORDED_MODEL;
    tokensByModel.set(model, (tokensByModel.get(model) ?? 0) + tokens);
  }

  const tokenTrend = axis.map((key) => tokensByDay.get(key) ?? 0);
  const conversationTrend = axis.map(
    (key) =>
      (conversationsByDay.get(key)?.size ?? 0) +
      (unattributedByDay.get(key) ?? 0),
  );
  const windowTokens = tokenTrend.reduce((sum, value) => sum + value, 0);
  const windowConversations = conversationTrend.reduce(
    (sum, value) => sum + value,
    0,
  );

  // Lifetime totals, which is the honest answer to "how many conversations has
  // this bot had" — the window figures above are for the trend only.
  const allConversations =
    new Set(
      spend.map((row) => row.refId).filter((id): id is string => Boolean(id)),
    ).size + spend.filter((row) => !row.refId).length;

  const modelData = [...tokensByModel]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  const dayData = axis.map((key) => ({
    label: dayLabel(key),
    value: tokensByDay.get(key) ?? 0,
  }));

  const windowNote = `${dayLabel(startDay)} – ${dayLabel(endDay)} (UTC)`;
  const lastActive = spendDays[spendDays.length - 1]!;

  return (
    <div className={cn("space-y-5", className)}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label={`Tokens spent · last ${windowDays} days`}
          // The WINDOW figure, compared against the window before it. It used to
          // show the LIFETIME total next to a 14-day comparison, so a bot with
          // 1.2M tokens all-time and 50k in the previous fortnight rendered
          // "+2300%" in red — a spend explosion that never happened, getting
          // worse every day the bot stayed in service. Compare like with like.
          value={windowTokens}
          previous={hasPriorHistory ? priorTokens : undefined}
          comparisonLabel={`vs previous ${windowDays} days`}
          trend={tokenTrend}
          // A rise in spend is neither good nor bad on its own, but it is the
          // number that empties the wallet, so it is not flagged as an improvement.
          higherIsBetter={false}
          hint={`${formatCompact(totalTokens)} all time · ${windowNote}`}
        />
        <StatTile
          label="Conversations"
          value={allConversations}
          trend={conversationTrend}
          hint={`${formatCompact(windowConversations)} in the last ${windowDays} days, across ${formatCompact(spend.length)} billed messages. Last activity ${dayLabel(lastActive)}.`}
        />
        {balance !== undefined && (
          <StatTile
            label="Chat token balance"
            value={balance}
            hint="Shared by every chatbot on this account. At zero, all of them stop answering."
          />
        )}
      </div>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <div className="grid gap-8 lg:grid-cols-2">
          <BarChart
            title={`Tokens per day · last ${windowDays} days`}
            data={dayData}
          />
          <BarChart title="Tokens by model" data={modelData} />
        </div>

        <div className="text-muted-foreground mt-5 space-y-1 text-xs leading-relaxed">
          <p>
            Tokens cover the question and the answer together, so a longer reply
            costs more. Days are cut in UTC, which is also how a conversation
            running over midnight comes to be counted on both days.
          </p>
          {modelData.some((datum) => datum.label === UNRECORDED_MODEL) && (
            <p>
              Some spend predates per-model recording and is grouped under “
              {UNRECORDED_MODEL}”.
            </p>
          )}
          {refunded > 0 && (
            <p>
              {formatCompact(refunded)} tokens have been refunded on this bot.
              Refunds are excluded from the figures above, which show gross
              spend.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * The never-used state. Framed as "not yet", with the reason it might be quiet —
 * a bot with no usage is the normal state five minutes after it is created, and
 * dressing that as a warning teaches operators to distrust the panel.
 */
function EmptyUsage({
  chatbotName,
  balance,
  className,
}: {
  chatbotName: string;
  balance?: number;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <h2 className="text-base font-semibold">Usage</h2>
      <div className="border-border text-muted-foreground mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm">
        <Bot aria-hidden="true" className="size-6" />
        <p className="max-w-md leading-relaxed">
          {chatbotName} has not answered anyone yet, so nothing has been
          charged. Tokens, conversations and the per-model split appear here
          after the first reply — paste the embed snippet on your site and make
          sure the bot is active.
        </p>
        {balance !== undefined && (
          <p className="flex items-center gap-1.5">
            <Coins aria-hidden="true" className="size-3.5" />
            {formatCompact(balance)} chat tokens available on this account.
          </p>
        )}
      </div>
    </section>
  );
}
