import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

describeWithDatabase("captureLead", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { contactEnquiries } = await import("@/lib/server/db/collections");
    await (await contactEnquiries()).deleteMany({});
  });

  it("stores a lead with kind, consent, and clean attribution, visible in the inbox", async () => {
    const { captureLead } = await import("@/lib/server/leads/capture");
    const { listLeads } = await import("@/lib/server/leads/repository");
    const now = new Date("2026-10-18T09:00:00.000Z");

    const result = await captureLead(
      {
        kind: "magnet",
        source: "resources/website-checklist",
        email: "  Owner@Clinic.example ",
        name: "Asha",
        consent: { contact: true, marketing: true, text: "Send me the guide." },
        attribution: {
          utmSource: "linkedin",
          utmMedium: "x@y.com",
          referrerHost: "www.linkedin.com",
          landingPath: "/resources?email=x@y.com",
          firstSeenAt: "2026-10-17T08:00:00.000Z",
        },
        detail: { resourceSlug: "website-checklist" },
      },
      now,
    );
    expect(result.created).toBe(true);
    expect(result.id).toMatch(/^[a-f0-9]{24}$/);
    expect(result.reference).toMatch(/^BC-[A-F0-9]{8}$/);

    const { contactEnquiries } = await import("@/lib/server/db/collections");
    const { ObjectId } = await import("mongodb");
    const doc = await (
      await contactEnquiries()
    ).findOne({ _id: new ObjectId(result.id) });
    expect(doc).toMatchObject({
      kind: "magnet",
      source: "resources/website-checklist",
      email: "owner@clinic.example",
      name: "Asha",
      status: "new",
      message: "Requested a resource.",
      consent: {
        contact: true,
        marketing: true,
        text: "Send me the guide.",
        at: now,
      },
      attribution: {
        utmSource: "linkedin",
        utmMedium: null,
        referrerHost: "www.linkedin.com",
        landingPath: "/resources",
      },
      detail: { resourceSlug: "website-checklist" },
    });

    const page = await listLeads({ kind: "enquiry" });
    expect(page.items.map((i) => i.id)).toContain(result.id);
    const row = page.items.find((i) => i.id === result.id);
    expect(row?.source).toBe("resources/website-checklist");
    expect(row?.status).toBe("new");
  });

  it("accepts a phone-only callback request and names the lead by it", async () => {
    const { captureLead } = await import("@/lib/server/leads/capture");
    const result = await captureLead({
      kind: "call",
      source: "site-assistant",
      phone: "+61 400 000 000",
      consent: { contact: true, text: "Call me back." },
    });
    const { contactEnquiries } = await import("@/lib/server/db/collections");
    const { ObjectId } = await import("mongodb");
    const doc = await (
      await contactEnquiries()
    ).findOne({ _id: new ObjectId(result.id) });
    expect(doc?.name).toBe("+61 400 000 000");
    expect(doc?.email).toBe("");
    expect(doc?.consent?.marketing).toBe(false);
    expect(doc?.attribution).toBeNull();
  });

  it("is idempotent on requestId", async () => {
    const { captureLead } = await import("@/lib/server/leads/capture");
    const input = {
      kind: "demo" as const,
      source: "demo",
      email: "a@b.example",
      consent: { contact: true },
      requestId: "req-1234567890",
    };
    const first = await captureLead(input);
    const second = await captureLead(input);
    expect(second.id).toBe(first.id);
    expect(second.created).toBe(false);
    const { contactEnquiries } = await import("@/lib/server/db/collections");
    expect(await (await contactEnquiries()).countDocuments({})).toBe(1);
  });

  it("rejects a lead with no way to reach the person, or bad input", async () => {
    const { captureLead, LeadCaptureError } =
      await import("@/lib/server/leads/capture");
    await expect(
      captureLead({
        kind: "chat",
        source: "site-assistant",
        consent: { contact: true },
      }),
    ).rejects.toBeInstanceOf(LeadCaptureError);
    await expect(
      captureLead({
        kind: "chat",
        source: "has spaces and <tags>",
        email: "a@b.example",
        consent: { contact: true },
      }),
    ).rejects.toBeInstanceOf(LeadCaptureError);
    await expect(
      captureLead({
        kind: "magnet",
        source: "x",
        email: "not-an-email",
        consent: { contact: true },
      }),
    ).rejects.toBeInstanceOf(LeadCaptureError);
  });
});
