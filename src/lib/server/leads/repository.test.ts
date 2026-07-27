import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Integration tests for the unified inbox.
 *
 * The `$unionWith` aggregation is the risky part of this module: three
 * collections with three shapes are projected into one, and a mistake shows up
 * as a lead silently missing from the operator's list rather than as an error.
 * These run against a real MongoDB for that reason — a fake would not tell us
 * whether the pipeline is valid.
 */

async function seed() {
  const { contactEnquiries, consultantRequests, auditReports } =
    await import("@/lib/server/db/collections");

  const base = (offsetMinutes: number) => {
    const at = new Date(Date.UTC(2026, 6, 26, 12, 0, 0));
    at.setUTCMinutes(at.getUTCMinutes() + offsetMinutes);
    return at;
  };

  await (
    await contactEnquiries()
  ).insertOne({
    requestId: "req-enq-1",
    reference: "BC-ENQ001",
    name: "Ada Lovelace",
    email: "ada@example.com",
    company: "Analytical Engines",
    budget: "$5k-10k",
    message: "We need a booking system for our clinic.",
    role: "Founder",
    source: "contact-form",
    status: "new",
    emailStatus: "sent",
    createdAt: base(0),
    updatedAt: base(0),
  });

  await (
    await consultantRequests()
  ).insertOne({
    requestId: "req-con-1",
    reference: "BC-AI-CON1",
    input: {
      name: "Grace Hopper",
      email: "grace@example.com",
      company: "Compilers Ltd",
      description: "A marketplace with payments.",
      budget: "$25k+",
    },
    quote: { total: 30000 },
    recommendation: { summary: "Build an MVP first." },
    model: "google/gemini-2.5-flash",
    email: "grace@example.com",
    status: "qualified",
    notes: [],
    createdAt: base(10),
    updatedAt: base(10),
  });

  // Deliberately written *without* the CRM fields, the way the public audit
  // route wrote them before the inbox existed.
  await (
    await auditReports()
  ).insertOne({
    requestId: "req-aud-1",
    auditedUrl: "https://rossi.example.com/",
    hostname: "rossi.example.com",
    result: {
      auditedUrl: "https://rossi.example.com/",
      finalUrl: "https://rossi.example.com/",
      auditedAt: base(20).toISOString(),
      responseTimeMs: 420,
      statusCode: 200,
      scores: { seo: 70, performance: 80, accessibility: 60, security: 50 },
      overallScore: 65,
      findings: [],
      scope: "test",
    },
    email: null,
    source: "public-tool",
    shareId: null,
    createdAt: base(20),
    updatedAt: base(20),
  } as never);
}

describeWithDatabase("leads inbox", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { contactEnquiries, consultantRequests, auditReports } =
      await import("@/lib/server/db/collections");
    await (await contactEnquiries()).deleteMany({});
    await (await consultantRequests()).deleteMany({});
    await (await auditReports()).deleteMany({});
  });

  it("returns leads from all three sources in one list, newest first", async () => {
    const { listLeads } = await import("@/lib/server/leads/repository");
    await seed();

    const page = await listLeads();
    expect(page.total).toBe(3);
    // Newest first: audit (t+20), consultant (t+10), enquiry (t+0).
    expect(page.items.map((item) => item.kind)).toEqual([
      "audit",
      "consultant",
      "enquiry",
    ]);
  });

  it("projects each shape into the same summary fields", async () => {
    const { listLeads } = await import("@/lib/server/leads/repository");
    await seed();
    const page = await listLeads();

    const enquiry = page.items.find((item) => item.kind === "enquiry")!;
    expect(enquiry.name).toBe("Ada Lovelace");
    expect(enquiry.email).toBe("ada@example.com");
    expect(enquiry.summary).toContain("booking system");
    expect(enquiry.budget).toBe("$5k-10k");

    // The consultant's details live inside a nested `input` object.
    const consultant = page.items.find((item) => item.kind === "consultant")!;
    expect(consultant.name).toBe("Grace Hopper");
    expect(consultant.email).toBe("grace@example.com");
    expect(consultant.company).toBe("Compilers Ltd");
    expect(consultant.summary).toContain("marketplace");
    expect(consultant.status).toBe("qualified");

    const audit = page.items.find((item) => item.kind === "audit")!;
    expect(audit.summary).toBe("https://rossi.example.com/");
    expect(audit.score).toBe(65);
  });

  it("defaults a missing status to new rather than dropping the lead", async () => {
    // The audit document has no `status` field at all. Without the `$ifNull`
    // guard it would sort and filter as null and vanish from the default view.
    const { listLeads } = await import("@/lib/server/leads/repository");
    await seed();

    const audit = (await listLeads()).items.find(
      (item) => item.kind === "audit",
    )!;
    expect(audit.status).toBe("new");
    expect(audit.noteCount).toBe(0);
    expect(audit.assignedToId).toBeNull();
  });

  it("filters by status across sources", async () => {
    const { listLeads } = await import("@/lib/server/leads/repository");
    await seed();

    expect((await listLeads({ status: "qualified" })).total).toBe(1);
    expect((await listLeads({ status: "new" })).total).toBe(2);
    expect((await listLeads({ status: "all" })).total).toBe(3);
  });

  it("filters by source", async () => {
    const { listLeads } = await import("@/lib/server/leads/repository");
    await seed();

    expect((await listLeads({ kind: "audit" })).total).toBe(1);
    expect((await listLeads({ kind: "enquiry" })).total).toBe(1);
    expect((await listLeads({ kind: "consultant" })).total).toBe(1);
  });

  it("searches name, email, company, summary, and reference", async () => {
    const { listLeads } = await import("@/lib/server/leads/repository");
    await seed();

    expect((await listLeads({ search: "lovelace" })).total).toBe(1);
    expect((await listLeads({ search: "grace@" })).total).toBe(1);
    expect((await listLeads({ search: "Compilers" })).total).toBe(1);
    expect((await listLeads({ search: "marketplace" })).total).toBe(1);
    expect((await listLeads({ search: "BC-ENQ001" })).total).toBe(1);
    expect((await listLeads({ search: "rossi.example.com" })).total).toBe(1);
  });

  it("treats a regex metacharacter in the search box as literal text", async () => {
    const { listLeads } = await import("@/lib/server/leads/repository");
    await seed();
    expect((await listLeads({ search: ".*" })).total).toBe(0);
  });

  it("paginates with a consistent total", async () => {
    const { listLeads } = await import("@/lib/server/leads/repository");
    await seed();

    const first = await listLeads({ pageSize: 2, page: 1 });
    expect(first.items).toHaveLength(2);
    expect(first.total).toBe(3);
    expect(first.totalPages).toBe(2);

    const second = await listLeads({ pageSize: 2, page: 2 });
    expect(second.items).toHaveLength(1);
    // No lead appears on both pages.
    const ids = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("clamps a page beyond the end back to the last real page", async () => {
    const { listLeads } = await import("@/lib/server/leads/repository");
    await seed();

    const page = await listLeads({ pageSize: 2, page: 99 });
    expect(page.page).toBe(2);
    expect(page.items).toHaveLength(1);
  });

  it("handles an empty inbox", async () => {
    const { listLeads, getLeadStats } =
      await import("@/lib/server/leads/repository");

    const page = await listLeads();
    expect(page).toMatchObject({ total: 0, items: [], totalPages: 1, page: 1 });
    expect((await getLeadStats()).total).toBe(0);
  });

  it("counts by status and source", async () => {
    const { getLeadStats } = await import("@/lib/server/leads/repository");
    await seed();

    const stats = await getLeadStats();
    expect(stats.total).toBe(3);
    expect(stats.byStatus.new).toBe(2);
    expect(stats.byStatus.qualified).toBe(1);
    expect(stats.byKind.enquiry).toBe(1);
    expect(stats.byKind.consultant).toBe(1);
    expect(stats.byKind.audit).toBe(1);
  });

  it("loads one lead by kind and id", async () => {
    const { listLeads, getLead } =
      await import("@/lib/server/leads/repository");
    await seed();

    const summary = (await listLeads({ kind: "consultant" })).items[0]!;
    const detail = await getLead("consultant", summary.id);
    expect(detail?.kind).toBe("consultant");
    if (detail?.kind === "consultant") {
      expect(detail.doc.model).toBe("google/gemini-2.5-flash");
      expect(detail.doc.quote).toEqual({ total: 30000 });
    }
  });

  it("returns null for a malformed or unknown id", async () => {
    const { getLead } = await import("@/lib/server/leads/repository");
    expect(await getLead("enquiry", "not-an-id")).toBeNull();
    expect(await getLead("enquiry", "6a662ba0e453bdd310d2fa53")).toBeNull();
  });

  it("changes status, assigns, and appends notes", async () => {
    const { listLeads, getLead, setLeadStatus, assignLead, addLeadNote } =
      await import("@/lib/server/leads/repository");
    await seed();

    const summary = (await listLeads({ kind: "audit" })).items[0]!;

    expect(await setLeadStatus("audit", [summary.id], "qualified")).toBe(1);
    expect(await assignLead("audit", summary.id, "user-1")).toBe(true);
    expect(
      await addLeadNote("audit", summary.id, {
        authorId: "user-1",
        authorName: "Ismail",
        body: "  Called the owner.  ",
      }),
    ).toBe(true);

    const detail = await getLead("audit", summary.id);
    if (detail?.kind === "audit") {
      expect(detail.doc.status).toBe("qualified");
      expect(detail.doc.assignedToId).toBe("user-1");
      expect(detail.doc.notes).toHaveLength(1);
      expect(detail.doc.notes![0]!.body).toBe("Called the owner.");
    }
  });

  it("bounds a very long note rather than storing it whole", async () => {
    const { listLeads, getLead, addLeadNote } =
      await import("@/lib/server/leads/repository");
    await seed();
    const summary = (await listLeads({ kind: "enquiry" })).items[0]!;

    await addLeadNote("enquiry", summary.id, {
      authorId: null,
      authorName: "System",
      body: "x".repeat(9_000),
    });

    const detail = await getLead("enquiry", summary.id);
    if (detail?.kind === "enquiry") {
      expect(detail.doc.notes![0]!.body).toHaveLength(4_000);
      // A system note carries no author id, and must still be stored.
      expect(detail.doc.notes![0]!.authorId).toBeNull();
    }
  });

  it("ignores malformed ids in a bulk status change", async () => {
    const { listLeads, setLeadStatus } =
      await import("@/lib/server/leads/repository");
    await seed();
    const summary = (await listLeads({ kind: "enquiry" })).items[0]!;

    expect(
      await setLeadStatus("enquiry", [summary.id, "nope", ""], "lost"),
    ).toBe(1);
  });

  it("exports every matching lead as CSV", async () => {
    const { listLeadsForExport, toCsv } =
      await import("@/lib/server/leads/repository");
    await seed();

    const rows = await listLeadsForExport();
    expect(rows).toHaveLength(3);

    const csv = toCsv(rows);
    const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(lines).toHaveLength(4);
    expect(csv).toContain("ada@example.com");
    expect(csv).toContain("grace@example.com");
    expect(csv).toContain("rossi.example.com");
  });

  it("respects a filter when exporting", async () => {
    const { listLeadsForExport } =
      await import("@/lib/server/leads/repository");
    await seed();
    expect(await listLeadsForExport({ kind: "enquiry" })).toHaveLength(1);
  });

  it("honours the export cap", async () => {
    const { listLeadsForExport } =
      await import("@/lib/server/leads/repository");
    await seed();
    expect(await listLeadsForExport({}, 2)).toHaveLength(2);
  });
});
