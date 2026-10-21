import { NextRequest } from "next/server";
import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

const SLUG = "website-launch-checklist-clinics";
const IP = "203.0.113.50";

function makeRequest(body: unknown, ip = IP): NextRequest {
  return new NextRequest("http://www.bitecodes.com/api/resources/request", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describeWithDatabase("POST /api/resources/request", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { contactEnquiries, leadMagnetRequests, rateLimits } =
      await import("@/lib/server/db/collections");
    await (await contactEnquiries()).deleteMany({});
    await (await leadMagnetRequests()).deleteMany({});
    await (await rateLimits()).deleteMany({});
  });

  it("returns the checklist and records an unticked-consent lead", async () => {
    const { POST } = await import("@/app/api/resources/request/route");
    const response = await POST(
      makeRequest({
        slug: SLUG,
        email: "Owner@Example.com",
        name: "  ",
        followUp: false,
        newsletter: false,
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      checklist: { title: string; items: string[] };
      reference: string;
    };
    expect(payload.ok).toBe(true);
    expect(payload.checklist.items.length).toBeGreaterThan(8);
    expect(payload.reference).toMatch(/^BC-[A-Z0-9]{8}$/);

    const { contactEnquiries, leadMagnetRequests } =
      await import("@/lib/server/db/collections");
    const leads = await (await contactEnquiries()).find({}).toArray();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      kind: "magnet",
      source: `resources/${SLUG}`,
      email: "owner@example.com",
      name: "owner@example.com",
      consent: { contact: false, marketing: false, text: null },
    });

    const requests = await (await leadMagnetRequests()).find({}).toArray();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      resourceSlug: SLUG,
      email: "owner@example.com",
      leadId: expect.any(String),
    });
  });

  it("records both consent flags when the visitor ticks them", async () => {
    const { POST } = await import("@/app/api/resources/request/route");
    const response = await POST(
      makeRequest(
        {
          slug: SLUG,
          email: "consenting@example.com",
          followUp: true,
          newsletter: true,
        },
        "203.0.113.51",
      ),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      newsletter: string;
    };
    // The newsletter owner may not have shipped yet (unavailable) or has shipped (pending);
    // the checklist must still be delivered and the status stated.
    expect(payload.ok).toBe(true);
    expect(["unavailable", "pending"]).toContain(payload.newsletter);

    const { contactEnquiries } = await import("@/lib/server/db/collections");
    const lead = await (
      await contactEnquiries()
    ).findOne({
      email: "consenting@example.com",
    });
    expect(lead?.consent).toMatchObject({ contact: true, marketing: true });
    expect(lead?.consent?.text).toContain("follow up about this guide");
    expect(lead?.consent?.text).toContain("Bitecodes newsletter");
  });

  it("refuses a slug with no checklist and an invalid address", async () => {
    const { POST } = await import("@/app/api/resources/request/route");

    const missing = await POST(
      makeRequest(
        { slug: "not-a-guide", email: "a@example.com" },
        "203.0.113.52",
      ),
    );
    expect(missing.status).toBe(404);

    const invalid = await POST(
      makeRequest({ slug: SLUG, email: "not-an-email" }, "203.0.113.53"),
    );
    expect(invalid.status).toBe(400);
  });
});
