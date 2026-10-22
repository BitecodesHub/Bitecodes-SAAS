import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import { buildProposalPricing } from "@/lib/proposals/pricing";
import type { CreateProposalInput } from "@/lib/server/proposals/repository";

/**
 * Integration tests for the proposals repository.
 *
 * The public token and the acceptance transition are the two places where a
 * mistake is not a cosmetic bug: a stored token would leak every proposal, and
 * a non-atomic acceptance could record the same decision twice. Both are
 * exercised against a real MongoDB because the guarantees come from atomic
 * `findOneAndUpdate` behaviour, not from application-level checks.
 */

function input(
  overrides: Partial<CreateProposalInput> = {},
): CreateProposalInput {
  const pricing = buildProposalPricing({
    currency: "INR",
    selections: [
      { serviceSlug: "website-development", quantity: 1 },
      { serviceSlug: "technical-consulting", quantity: 4 },
    ],
    includeMaintenance: false,
    maintenanceMonths: 3,
    milestoneCount: 3,
  });

  return {
    leadRef: null,
    clientName: "Ada Lovelace",
    clientEmail: "ada@example.com",
    company: "Analytical Engines",
    title: "Analytical engine website",
    summary: "A website for the analytical engine.",
    scope: ["Discovery", "Build", "Launch"],
    deliverables: ["Production website"],
    milestones: [
      { name: "Discovery", description: "Agree scope", dueOffsetDays: 7 },
      { name: "Build", description: "Build the site", dueOffsetDays: 30 },
      { name: "Launch", description: "Ship it", dueOffsetDays: 45 },
    ],
    currency: "INR",
    lineItems: pricing.lineItems,
    total: pricing.total,
    retainerUpsell: pricing.retainerUpsell,
    paymentSchedule: pricing.paymentSchedule,
    assumptions: ["Client provides content"],
    exclusions: ["GST"],
    termsLinks: [
      { label: "Guarantees", url: "/guarantees" },
      { label: "Terms & Conditions", url: "/terms" },
    ],
    validUntil: new Date("2026-12-31T23:59:59.999Z"),
    createdById: null,
    aiAssisted: false,
    ...overrides,
  };
}

describeWithDatabase("proposals repository", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { proposals } = await import("@/lib/server/db/collections");
    await (await proposals()).deleteMany({});
  });

  it("stores only a hash of the derived token", async () => {
    const { createProposal, deriveProposalToken, getProposalByToken } =
      await import("@/lib/server/proposals/repository");
    const { proposals } = await import("@/lib/server/db/collections");

    const created = await createProposal(input());
    const token = deriveProposalToken(created.proposalId);

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(created.proposalId).toMatch(/^PROP-\d{4}-[0-9A-F]{16}$/);
    expect(
      (created as unknown as Record<string, unknown>).token,
    ).toBeUndefined();

    const stored = await (
      await proposals()
    ).findOne({
      proposalId: created.proposalId,
    });
    expect(stored?.tokenHash).toBeDefined();
    expect(stored?.tokenHash).not.toBe(token);
    expect(JSON.stringify(stored)).not.toContain(token);

    const found = await getProposalByToken(token);
    expect(found?.proposalId).toBe(created.proposalId);
    expect(await getProposalByToken("f".repeat(64))).toBeNull();
    expect(await getProposalByToken("short")).toBeNull();
  });

  it("accepts once, only after sending, and keeps the signature", async () => {
    const {
      acceptProposal,
      createProposal,
      deriveProposalToken,
      getProposal,
      markProposalSent,
      recordProposalView,
    } = await import("@/lib/server/proposals/repository");

    const created = await createProposal(input());
    const token = deriveProposalToken(created.proposalId);

    // A draft cannot be accepted even with a valid link.
    expect(
      await acceptProposal(token, {
        name: "Ada Lovelace",
        title: "Founder",
        signature: "Ada Lovelace",
        ipHash: null,
      }),
    ).toEqual({ ok: false, reason: "not-open" });

    await markProposalSent(created.proposalId);
    const viewed = await recordProposalView(created.proposalId);
    expect(viewed?.status).toBe("viewed");
    expect(viewed?.viewCount).toBe(1);

    const accepted = await acceptProposal(token, {
      name: "Ada Lovelace",
      title: "Founder",
      signature: "Ada Lovelace",
      ipHash: "hashed-ip",
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.proposal.status).toBe("accepted");
    expect(accepted.proposal.acceptance).toMatchObject({
      name: "Ada Lovelace",
      title: "Founder",
      signature: "Ada Lovelace",
      ipHash: "hashed-ip",
    });

    // A second acceptance is refused, and so is a late decline.
    expect(
      await acceptProposal(token, {
        name: "Someone Else",
        title: "Director",
        signature: "Someone Else",
        ipHash: null,
      }),
    ).toEqual({ ok: false, reason: "not-open" });
    expect(
      await (
        await import("@/lib/server/proposals/repository")
      ).declineProposal(token, "Changed our mind", null),
    ).toEqual({ ok: false, reason: "not-open" });

    const reloaded = await getProposal(created.proposalId);
    expect(reloaded?.status).toBe("accepted");
    expect(reloaded?.declinedAt).toBeNull();
  });

  it("expires a stale link before it can be accepted", async () => {
    const {
      acceptProposal,
      createProposal,
      deriveProposalToken,
      getProposal,
      markProposalSent,
    } = await import("@/lib/server/proposals/repository");

    const created = await createProposal(
      input({ validUntil: new Date("2026-01-01T00:00:00.000Z") }),
    );
    await markProposalSent(created.proposalId);
    const token = deriveProposalToken(created.proposalId);

    const now = new Date("2026-02-01T00:00:00.000Z");
    const result = await acceptProposal(
      token,
      {
        name: "Ada Lovelace",
        title: "Founder",
        signature: "Ada Lovelace",
        ipHash: null,
      },
      now,
    );

    expect(result).toEqual({ ok: false, reason: "expired" });
    expect((await getProposal(created.proposalId))?.status).toBe("expired");
  });

  it("records an owner mark-lost with a reason, and refuses after acceptance", async () => {
    const {
      acceptProposal,
      createProposal,
      deriveProposalToken,
      getProposal,
      markProposalLost,
      markProposalSent,
    } = await import("@/lib/server/proposals/repository");

    const lost = await createProposal(input({ title: "Lost proposal" }));
    await markProposalSent(lost.proposalId);
    const changed = await markProposalLost(
      lost.proposalId,
      "Budget deferred to next quarter",
    );
    expect(changed?.status).toBe("declined");
    expect(changed?.decline).toMatchObject({
      reason: "Budget deferred to next quarter",
      source: "owner",
      ipHash: null,
    });

    const won = await createProposal(input({ title: "Won proposal" }));
    await markProposalSent(won.proposalId);
    await acceptProposal(deriveProposalToken(won.proposalId), {
      name: "Ada Lovelace",
      title: "Founder",
      signature: "Ada Lovelace",
      ipHash: null,
    });
    expect(
      await markProposalLost(won.proposalId, "Trying to overwrite the win"),
    ).toBeNull();
    expect((await getProposal(won.proposalId))?.status).toBe("accepted");
  });

  it("is idempotent about follow-up reminders", async () => {
    const {
      createProposal,
      listDueProposalReminders,
      markProposalSent,
      recordProposalReminder,
      recordProposalView,
    } = await import("@/lib/server/proposals/repository");

    const created = await createProposal(input());
    const sentAt = new Date("2026-10-01T09:00:00.000Z");
    await markProposalSent(created.proposalId, sentAt);
    await recordProposalView(
      created.proposalId,
      new Date("2026-10-01T10:00:00.000Z"),
    );

    const now = new Date("2026-10-05T10:00:00.000Z");
    const due = await listDueProposalReminders(now);
    expect(due.map((item) => item.proposalId)).toEqual([created.proposalId]);

    await recordProposalReminder(created.proposalId, now);
    expect(await listDueProposalReminders(now)).toEqual([]);

    // Due again after the repeat window, not before it.
    expect(
      await listDueProposalReminders(new Date("2026-10-09T10:00:00.000Z")),
    ).toEqual([]);
    expect(
      (
        await listDueProposalReminders(new Date("2026-10-13T10:00:00.000Z"))
      ).map((item) => item.proposalId),
    ).toEqual([created.proposalId]);
  });

  it("filters the list by status and search", async () => {
    const { createProposal, listProposals, markProposalSent } =
      await import("@/lib/server/proposals/repository");

    const sent = await createProposal(
      input({ title: "Sent project", clientName: "Grace Hopper" }),
    );
    await createProposal(
      input({ title: "Draft project", clientName: "Alan Turing" }),
    );
    await markProposalSent(sent.proposalId);

    expect((await listProposals({ status: "draft" })).total).toBe(1);
    expect((await listProposals({ status: "sent" })).total).toBe(1);
    expect((await listProposals({ search: "Grace" })).total).toBe(1);
    expect((await listProposals({ search: "PROP-" })).total).toBe(2);
  });
});
