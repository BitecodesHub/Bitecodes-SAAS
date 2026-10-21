"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { services } from "@/data/services";
import {
  SERVICE_PRICING,
  CURRENCIES,
  convertPrice,
  formatAmount,
  unitPhrase,
  type CurrencyCode,
} from "@/lib/pricing";
import {
  buildProposalPricing,
  MAINTENANCE_SERVICE_SLUG,
} from "@/lib/proposals/pricing";
import {
  linesToText,
  textToLines,
  type ProposalFormValues,
  type ProposalMilestoneInput,
} from "@/lib/proposals/form";
import { PROPOSAL_STATUS_LABELS } from "@/lib/proposals/display";
import {
  aiDraftProposalAction,
  createProposalAction,
  updateProposalAction,
} from "@/lib/server/proposals/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { ProposalStatus } from "@/lib/server/db/types";

/**
 * The proposal builder.
 *
 * The editor never holds a price as editable state. It renders `SERVICE_PRICING`
 * lines, lets the operator choose services and quantities, and asks the same
 * pure pricing function the server uses for a live preview. The server repeats
 * the calculation on save, so a modified request cannot change a total.
 */

interface ProposalEditorProps {
  mode: "create" | "edit";
  proposalId?: string;
  initial: ProposalFormValues;
  status?: ProposalStatus;
  canEdit?: boolean;
}

// Maintenance is the optional retainer add-on below, not a project line: the
// pricing function deliberately ignores it in `selections`.
const serviceOptions = SERVICE_PRICING.filter(
  (pricing) => pricing.slug !== MAINTENANCE_SERVICE_SLUG,
).map((pricing) => ({
  ...pricing,
  title:
    services.find((service) => service.slug === pricing.slug)?.title ??
    pricing.slug,
}));

export function ProposalEditor({
  mode,
  proposalId,
  initial,
  status = "draft",
  canEdit = true,
}: ProposalEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [drafting, startDrafting] = useTransition();

  const [form, setForm] = useState<ProposalFormValues>(initial);
  const [scopeText, setScopeText] = useState(linesToText(initial.scope));
  const [deliverablesText, setDeliverablesText] = useState(
    linesToText(initial.deliverables),
  );
  const [assumptionsText, setAssumptionsText] = useState(
    linesToText(initial.assumptions),
  );
  const [exclusionsText, setExclusionsText] = useState(
    linesToText(initial.exclusions),
  );
  const [operatorNotes, setOperatorNotes] = useState("");

  const pricing = useMemo(
    () =>
      buildProposalPricing({
        currency: form.currency,
        selections: form.selections,
        includeMaintenance: form.includeMaintenance,
        maintenanceMonths: form.maintenanceMonths,
        milestoneCount: form.milestones.length > 0 ? form.milestones.length : 2,
      }),
    [form],
  );

  function update<K extends keyof ProposalFormValues>(
    key: K,
    value: ProposalFormValues[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectionQuantity(slug: string): number {
    return (
      form.selections.find((selection) => selection.serviceSlug === slug)
        ?.quantity ?? 0
    );
  }

  function toggleService(slug: string) {
    setForm((current) => {
      const exists = current.selections.some(
        (selection) => selection.serviceSlug === slug,
      );
      return {
        ...current,
        selections: exists
          ? current.selections.filter(
              (selection) => selection.serviceSlug !== slug,
            )
          : [...current.selections, { serviceSlug: slug, quantity: 1 }],
      };
    });
  }

  function setQuantity(slug: string, quantity: number) {
    setForm((current) => ({
      ...current,
      selections: current.selections.map((selection) =>
        selection.serviceSlug === slug
          ? {
              ...selection,
              quantity: Math.min(100, Math.max(1, Math.round(quantity || 1))),
            }
          : selection,
      ),
    }));
  }

  function updateMilestone(
    index: number,
    patch: Partial<ProposalMilestoneInput>,
  ) {
    setForm((current) => ({
      ...current,
      milestones: current.milestones.map((milestone, position) =>
        position === index ? { ...milestone, ...patch } : milestone,
      ),
    }));
  }

  function addMilestone() {
    if (form.milestones.length >= 6) return;
    setForm((current) => ({
      ...current,
      milestones: [
        ...current.milestones,
        {
          name: `Milestone ${current.milestones.length + 1}`,
          description: "",
          dueOffsetDays: (current.milestones.length + 1) * 14,
        },
      ],
    }));
  }

  function removeMilestone(index: number) {
    setForm((current) => ({
      ...current,
      milestones: current.milestones.filter(
        (_, position) => position !== index,
      ),
    }));
  }

  function collectedForm(): ProposalFormValues {
    return {
      ...form,
      scope: textToLines(scopeText),
      deliverables: textToLines(deliverablesText),
      assumptions: textToLines(assumptionsText),
      exclusions: textToLines(exclusionsText),
    };
  }

  function save() {
    startTransition(async () => {
      const payload = collectedForm();
      const result =
        mode === "create"
          ? await createProposalAction(payload)
          : await updateProposalAction(proposalId!, payload);

      if (!result.ok) {
        toast({
          title: "Proposal not saved",
          description: result.error,
          variant: "error",
        });
        return;
      }

      toast({
        title: mode === "create" ? "Proposal created" : "Proposal saved",
        variant: "success",
      });
      if (mode === "create") {
        router.push(`/admin/proposals/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  function draftScope() {
    startDrafting(async () => {
      const result = await aiDraftProposalAction({
        leadRef: form.leadRef,
        title: form.title,
        clientName: form.clientName,
        company: form.company,
        selectedServiceSlugs: form.selections.map(
          (selection) => selection.serviceSlug,
        ),
        operatorNotes,
      });

      if (!result.ok) {
        toast({
          title: "Draft unavailable",
          description: result.error,
          variant: "error",
        });
        return;
      }

      const draft = result.data.draft as {
        summary: string;
        scope: string[];
        deliverables: string[];
        assumptions: string[];
      };
      setForm((current) => ({
        ...current,
        summary: draft.summary,
        aiAssisted: true,
      }));
      setScopeText(linesToText(draft.scope));
      setDeliverablesText(linesToText(draft.deliverables));
      setAssumptionsText(linesToText(draft.assumptions));
      toast({
        title: "Draft inserted",
        description: "Review the wording before saving or sending.",
        variant: "success",
      });
    });
  }

  const maintenance = SERVICE_PRICING.find(
    (item) => item.slug === MAINTENANCE_SERVICE_SLUG,
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr] xl:items-start">
      <div className="space-y-6">
        {!canEdit && (
          <div className="border-border bg-muted/40 text-muted-foreground rounded-2xl border p-4 text-sm">
            This proposal is {PROPOSAL_STATUS_LABELS[status].toLowerCase()} and
            can no longer be edited. Its record remains available below.
          </div>
        )}

        <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Client and proposal</h2>
            <Badge variant="muted">{PROPOSAL_STATUS_LABELS[status]}</Badge>
          </div>

          <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Client name" htmlFor="client-name">
              <Input
                id="client-name"
                value={form.clientName}
                onChange={(event) => update("clientName", event.target.value)}
                placeholder="Full name"
              />
            </Field>
            <Field label="Client email" htmlFor="client-email">
              <Input
                id="client-email"
                type="email"
                value={form.clientEmail}
                onChange={(event) => update("clientEmail", event.target.value)}
                placeholder="name@company.com"
              />
            </Field>
            <Field label="Company" htmlFor="company">
              <Input
                id="company"
                value={form.company}
                onChange={(event) => update("company", event.target.value)}
                placeholder="Company name"
              />
            </Field>
            <Field label="Proposal title" htmlFor="title">
              <Input
                id="title"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="Website redesign proposal"
              />
            </Field>
            <Field label="Currency" htmlFor="currency">
              <Select
                id="currency"
                value={form.currency}
                onChange={(event) =>
                  update("currency", event.target.value as CurrencyCode)
                }
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} — {currency.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valid until" htmlFor="valid-until">
              <Input
                id="valid-until"
                type="date"
                value={form.validUntil}
                onChange={(event) => update("validUntil", event.target.value)}
              />
            </Field>
            {form.leadRef && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground text-xs">
                  Linked lead:{" "}
                  <span className="text-foreground font-medium">
                    {form.leadRef}
                  </span>
                </p>
              </div>
            )}
          </fieldset>
        </section>

        <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <div>
            <h2 className="text-base font-semibold">Services and prices</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Prices come from the published starting rates. Changes here never
              create a custom price.
            </p>
          </div>

          <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
            {serviceOptions.map((option) => {
              const selected = selectionQuantity(option.slug) > 0;
              return (
                <div
                  key={option.slug}
                  className="border-border rounded-xl border p-3"
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleService(option.slug)}
                      className="border-input text-primary focus-visible:ring-ring/40 accent-primary mt-1 size-4 rounded border"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {option.title}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {formatAmount(
                          pricing.lineItems.find(
                            (line) => line.key === option.slug,
                          )?.unitAmount ??
                            convertPrice(option.startingFromUSD, form.currency),
                          form.currency,
                        )}{" "}
                        {unitPhrase(option.unit)}
                      </span>
                    </span>
                  </label>
                  {selected && (
                    <div className="mt-3 flex items-center gap-2">
                      <Label
                        htmlFor={`quantity-${option.slug}`}
                        className="text-muted-foreground text-xs"
                      >
                        Quantity
                      </Label>
                      <Input
                        id={`quantity-${option.slug}`}
                        type="number"
                        min={1}
                        max={100}
                        value={selectionQuantity(option.slug)}
                        onChange={(event) =>
                          setQuantity(option.slug, Number(event.target.value))
                        }
                        className="h-9 w-24"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>

          {pricing.retainerUpsell && canEdit && (
            <div className="border-primary/25 bg-primary/5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  Add a maintenance retainer
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatAmount(
                    pricing.retainerUpsell.monthlyAmount,
                    form.currency,
                  )}{" "}
                  per month for {pricing.retainerUpsell.months} months. Billed
                  monthly in advance.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => update("includeMaintenance", true)}
              >
                <Plus className="size-4" />
                Add retainer
              </Button>
            </div>
          )}

          {form.includeMaintenance && (
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="maintenance-months" className="text-sm">
                Retainer months
              </Label>
              <Input
                id="maintenance-months"
                type="number"
                min={1}
                max={12}
                disabled={!canEdit}
                value={form.maintenanceMonths}
                onChange={(event) =>
                  update("maintenanceMonths", Number(event.target.value) || 1)
                }
                className="h-9 w-24"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canEdit}
                onClick={() => update("includeMaintenance", false)}
              >
                Remove retainer
              </Button>
            </div>
          )}

          {maintenance && (
            <p className="text-muted-foreground text-xs">
              Retainer floor:{" "}
              {formatAmount(
                convertPrice(maintenance.startingFromUSD, form.currency),
                form.currency,
              )}{" "}
              {unitPhrase(maintenance.unit)}. The published response targets are
              in our guarantees.
            </p>
          )}
        </section>

        <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Narrative</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                One item per line for scope, deliverables, assumptions, and
                exclusions.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={draftScope}
              disabled={!canEdit || drafting || form.selections.length === 0}
            >
              {drafting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              AI draft scope
            </Button>
          </div>

          <fieldset disabled={!canEdit} className="space-y-4">
            <Field label="Summary" htmlFor="summary">
              <Textarea
                id="summary"
                value={form.summary}
                onChange={(event) => update("summary", event.target.value)}
                placeholder="A short, factual description of the engagement."
              />
            </Field>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Scope" htmlFor="scope">
                <Textarea
                  id="scope"
                  value={scopeText}
                  onChange={(event) => setScopeText(event.target.value)}
                  placeholder={"Discovery workshop\nDesign and build\nLaunch"}
                />
              </Field>
              <Field label="Deliverables" htmlFor="deliverables">
                <Textarea
                  id="deliverables"
                  value={deliverablesText}
                  onChange={(event) => setDeliverablesText(event.target.value)}
                  placeholder={"Production website\nRepository handover"}
                />
              </Field>
              <Field label="Assumptions" htmlFor="assumptions">
                <Textarea
                  id="assumptions"
                  value={assumptionsText}
                  onChange={(event) => setAssumptionsText(event.target.value)}
                  placeholder={
                    "Client provides content\nOne review round per milestone"
                  }
                />
              </Field>
              <Field label="Exclusions" htmlFor="exclusions">
                <Textarea
                  id="exclusions"
                  value={exclusionsText}
                  onChange={(event) => setExclusionsText(event.target.value)}
                  placeholder={"Third-party subscriptions\nGST"}
                />
              </Field>
            </div>
            <Field
              label="Notes for the AI draft (optional)"
              htmlFor="draft-notes"
            >
              <Textarea
                id="draft-notes"
                value={operatorNotes}
                onChange={(event) => setOperatorNotes(event.target.value)}
                placeholder="Anything the draft should know that is not in the lead."
                className="min-h-20"
              />
            </Field>
          </fieldset>
        </section>

        <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Milestones</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                The number of milestones sets the payment split. Due offsets are
                days after the agreed start.
              </p>
            </div>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMilestone}
                disabled={form.milestones.length >= 6}
              >
                <Plus className="size-4" />
                Add milestone
              </Button>
            )}
          </div>

          {form.milestones.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No milestones yet. The payment schedule defaults to a 50 percent
              deposit and a 50 percent final payment.
            </p>
          ) : (
            <div className="space-y-3">
              {form.milestones.map((milestone, index) => (
                <div
                  key={index}
                  className="border-border grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_100px_auto]"
                >
                  <Input
                    aria-label={`Milestone ${index + 1} name`}
                    value={milestone.name}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateMilestone(index, { name: event.target.value })
                    }
                    placeholder="Milestone name"
                  />
                  <Input
                    aria-label={`Milestone ${index + 1} description`}
                    value={milestone.description}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateMilestone(index, {
                        description: event.target.value,
                      })
                    }
                    placeholder="What is delivered"
                  />
                  <Input
                    aria-label={`Milestone ${index + 1} due in days`}
                    type="number"
                    min={0}
                    max={365}
                    value={milestone.dueOffsetDays}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateMilestone(index, {
                        dueOffsetDays: Number(event.target.value) || 0,
                      })
                    }
                  />
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove milestone ${index + 1}`}
                      onClick={() => removeMilestone(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {canEdit && (
          <div className="flex justify-end">
            <Button type="button" size="lg" onClick={save} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {mode === "create" ? "Create proposal" : "Save changes"}
            </Button>
          </div>
        )}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24">
        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Live total</h2>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {formatAmount(pricing.total, form.currency)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {pricing.lineItems.length} priced line
            {pricing.lineItems.length === 1 ? "" : "s"}. Recalculated by the
            server on save.
          </p>

          <div className="border-border mt-4 space-y-2 border-t pt-4">
            {pricing.lineItems.map((line) => (
              <div
                key={line.key}
                className="flex justify-between gap-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{line.label}</span>
                  <span className="text-muted-foreground block text-xs">
                    {line.quantity} ×{" "}
                    {formatAmount(line.unitAmount, form.currency)}
                  </span>
                </span>
                <span className="shrink-0 font-medium">
                  {formatAmount(line.amount, form.currency)}
                </span>
              </div>
            ))}
            {pricing.lineItems.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Select at least one service.
              </p>
            )}
          </div>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Payment schedule</h2>
          <ul className="mt-3 space-y-2">
            {pricing.paymentSchedule.map((term) => (
              <li
                key={term.label}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span>
                  <span className="block">{term.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {term.percent}% of total
                  </span>
                </span>
                <span className="shrink-0 font-medium">
                  {formatAmount(term.amount, form.currency)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Milestone payments follow the published commitment on{" "}
            <Link href="/guarantees" className="underline underline-offset-2">
              guarantees
            </Link>
            . The final term absorbs rounding.
          </p>
        </section>

        {pricing.retainerUpsell && (
          <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Check className="size-4" />
              Suggested retainer
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {pricing.retainerUpsell.description}
            </p>
            <p className="mt-3 text-sm font-medium">
              {formatAmount(
                pricing.retainerUpsell.monthlyAmount,
                form.currency,
              )}{" "}
              per month
            </p>
          </section>
        )}
      </aside>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
