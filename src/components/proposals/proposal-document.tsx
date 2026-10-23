import type { ReactNode } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatAmount } from "@/lib/pricing";
import type { ProposalDoc } from "@/lib/server/db/types";
import { Badge } from "@/components/ui/badge";

/**
 * The proposal as the client reads it.
 *
 * Shared by the token page and the admin preview so both show the same
 * document. `actions` is where the public page adds the accept and decline
 * controls; the preview deliberately passes nothing.
 */

interface ProposalDocumentProps {
  proposal: ProposalDoc;
  actions?: ReactNode;
}

function formatDate(value: Date | null): string {
  if (!value) return "No expiry";
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(value: Date | null): string {
  if (!value) return "";
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function ProposalDocument({ proposal, actions }: ProposalDocumentProps) {
  const isOpen = proposal.status === "sent" || proposal.status === "viewed";

  return (
    <>
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{proposal.proposalId}</Badge>
          {proposal.status === "draft" && (
            <Badge variant="secondary">Draft preview</Badge>
          )}
          {isOpen && (
            <Badge variant="muted">
              <Clock className="size-3" />
              Awaiting decision
            </Badge>
          )}
          {proposal.status === "accepted" && (
            <Badge variant="secondary">
              <CheckCircle2 className="size-3" />
              Accepted
            </Badge>
          )}
          {(proposal.status === "declined" ||
            proposal.status === "expired") && (
            <Badge variant="muted">
              <XCircle className="size-3" />
              {proposal.status === "declined" ? "Declined" : "Expired"}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-[13px] font-medium">
            Prepared for {proposal.company || proposal.clientName || "you"}
          </p>
          <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
            {proposal.title}
          </h1>
          {proposal.summary && (
            <p className="text-muted-foreground max-w-2xl text-[16px] leading-[1.65]">
              {proposal.summary}
            </p>
          )}
        </div>

        <dl className="bg-surface-2 mt-6 grid gap-6 rounded-[24px] p-6 sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
              Total
            </dt>
            <dd className="mt-1.5 text-[20px] font-semibold tracking-[-0.01em]">
              {formatAmount(proposal.total, proposal.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
              Prepared on
            </dt>
            <dd className="mt-1.5 text-[15px]">
              {formatDate(proposal.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
              Valid until
            </dt>
            <dd className="mt-1.5 text-[15px]">
              {formatDate(proposal.validUntil)}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-10 space-y-8">
        <DocumentSection title="Scope">
          <BulletList
            items={proposal.scope}
            empty="The scope is described in the summary."
          />
        </DocumentSection>

        <DocumentSection title="Deliverables">
          <BulletList
            items={proposal.deliverables}
            empty="The deliverables are described in the scope."
          />
        </DocumentSection>

        {proposal.milestones.length > 0 && (
          <DocumentSection title="Milestones">
            <div className="bg-surface-2 overflow-hidden rounded-[20px]">
              <table className="w-full text-[15px]">
                <thead className="text-muted-foreground text-left">
                  <tr>
                    <th className="px-5 py-3.5 text-[13px] font-semibold">
                      Milestone
                    </th>
                    <th className="px-5 py-3.5 text-[13px] font-semibold">
                      What is delivered
                    </th>
                    <th className="px-5 py-3.5 text-right text-[13px] font-semibold">
                      Due
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.milestones.map((milestone, index) => (
                    <tr
                      key={`${milestone.name}-${index}`}
                      className="border-background border-t"
                    >
                      <td className="px-5 py-4 font-medium">
                        {milestone.name}
                      </td>
                      <td className="text-muted-foreground px-5 py-4">
                        {milestone.description || "—"}
                      </td>
                      <td className="text-muted-foreground px-5 py-4 text-right whitespace-nowrap">
                        Day {milestone.dueOffsetDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocumentSection>
        )}

        <DocumentSection title="Services and pricing">
          <div className="bg-surface-2 overflow-hidden rounded-[20px]">
            <table className="w-full text-[15px]">
              <thead className="text-muted-foreground text-left">
                <tr>
                  <th className="px-5 py-3.5 text-[13px] font-semibold">
                    Service
                  </th>
                  <th className="px-5 py-3.5 text-right text-[13px] font-semibold">
                    Quantity
                  </th>
                  <th className="px-5 py-3.5 text-right text-[13px] font-semibold">
                    Unit
                  </th>
                  <th className="px-5 py-3.5 text-right text-[13px] font-semibold">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {proposal.lineItems.map((line) => (
                  <tr key={line.key} className="border-background border-t">
                    <td className="px-5 py-4">
                      <span className="font-medium">{line.label}</span>
                      {line.description && (
                        <span className="text-muted-foreground mt-1 block text-[13px] leading-[1.5]">
                          {line.description}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">{line.quantity}</td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {formatAmount(line.unitAmount, proposal.currency)}
                    </td>
                    <td className="px-5 py-4 text-right font-medium whitespace-nowrap">
                      {formatAmount(line.amount, proposal.currency)}
                    </td>
                  </tr>
                ))}
                <tr className="border-background bg-background border-t">
                  <td className="px-5 py-4 font-semibold" colSpan={3}>
                    Total
                  </td>
                  <td className="px-5 py-4 text-right text-[17px] font-semibold whitespace-nowrap">
                    {formatAmount(proposal.total, proposal.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </DocumentSection>

        <DocumentSection title="Payment schedule">
          <ul className="space-y-3">
            {proposal.paymentSchedule.map((term) => (
              <li
                key={term.label}
                className="bg-surface-2 flex items-center justify-between gap-4 rounded-[18px] px-5 py-4 text-[15px]"
              >
                <span>
                  <span className="block font-medium">{term.label}</span>
                  <span className="text-muted-foreground mt-0.5 block text-[13px]">
                    {term.percent} percent of the total
                  </span>
                </span>
                <span className="font-medium whitespace-nowrap">
                  {formatAmount(term.amount, proposal.currency)}
                </span>
              </li>
            ))}
          </ul>
        </DocumentSection>

        {proposal.retainerUpsell && (
          <DocumentSection title="Optional retainer">
            <div className="bg-primary/5 rounded-[24px] p-6">
              <p className="text-[15px] leading-[1.6] font-medium">
                {proposal.retainerUpsell.label} —{" "}
                {formatAmount(
                  proposal.retainerUpsell.monthlyAmount,
                  proposal.currency,
                )}{" "}
                per month for {proposal.retainerUpsell.months} months
              </p>
              <p className="text-muted-foreground mt-2 text-[15px] leading-[1.6]">
                {proposal.retainerUpsell.description}
              </p>
              <p className="text-muted-foreground mt-2 text-[13px] leading-[1.5]">
                Optional. The rest of this proposal does not depend on it.
              </p>
            </div>
          </DocumentSection>
        )}

        <div className="grid gap-8 sm:grid-cols-2">
          <DocumentSection title="Assumptions">
            <BulletList
              items={proposal.assumptions}
              empty="None beyond the standard terms."
            />
          </DocumentSection>
          <DocumentSection title="Exclusions">
            <BulletList
              items={proposal.exclusions}
              empty="None beyond the standard terms."
            />
          </DocumentSection>
        </div>

        {proposal.termsLinks.length > 0 && (
          <p className="text-muted-foreground text-[15px] leading-[1.6]">
            This proposal is subject to our{" "}
            {proposal.termsLinks.map((link, index) => (
              <span key={link.url}>
                {index > 0 && " and "}
                <a
                  href={link.url}
                  className="text-primary underline underline-offset-2"
                >
                  {link.label}
                </a>
              </span>
            ))}
            .
          </p>
        )}

        {actions}

        {proposal.status === "accepted" && proposal.acceptance && (
          <DecisionPanel
            tone="accepted"
            title="This proposal is accepted"
            body={`Signed by ${proposal.acceptance.name}${
              proposal.acceptance.title ? `, ${proposal.acceptance.title}` : ""
            } on ${formatDateTime(proposal.acceptance.acceptedAt)}. We will be in touch to arrange the start date and the first invoice.`}
          />
        )}

        {proposal.status === "declined" && (
          <DecisionPanel
            tone="closed"
            title="This proposal was declined"
            body={
              proposal.decline?.source === "owner"
                ? "We have closed this proposal. Thank you for the time."
                : "Thank you for the reply. If circumstances change, we are happy to prepare a revised proposal."
            }
          />
        )}

        {proposal.status === "expired" && (
          <DecisionPanel
            tone="closed"
            title="This proposal has expired"
            body={`It was valid until ${formatDate(
              proposal.validUntil,
            )}. Ask us for an updated proposal and we will reissue it with current dates and pricing.`}
          />
        )}
      </div>
    </>
  );
}

function DocumentSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-[15px] leading-[1.6]">{empty}</p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li
          key={`${index}-${item.slice(0, 24)}`}
          className="flex items-start gap-3 text-[15px] leading-[1.6]"
        >
          <span className="bg-primary mt-2.5 size-1.5 shrink-0 rounded-full" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DecisionPanel({
  tone,
  title,
  body,
}: {
  tone: "accepted" | "closed";
  title: string;
  body: string;
}) {
  return (
    <section
      className={
        tone === "accepted"
          ? "bg-primary/5 rounded-[28px] p-7"
          : "bg-surface-2 rounded-[28px] p-7"
      }
    >
      <h2 className="flex items-center gap-2.5 text-[20px] font-semibold tracking-[-0.02em]">
        {tone === "accepted" ? (
          <CheckCircle2
            className="size-5"
            style={{ color: "var(--chart-3)" }}
          />
        ) : (
          <XCircle className="text-muted-foreground size-5" />
        )}
        {title}
      </h2>
      <p className="text-muted-foreground mt-2.5 max-w-2xl text-[15px] leading-[1.6]">
        {body}
      </p>
    </section>
  );
}
