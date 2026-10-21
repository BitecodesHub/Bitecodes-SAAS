import { expect, it } from "vitest";
import type { TestimonialDoc } from "@/lib/server/db/types";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

const approvedAt = new Date("2026-10-03T10:00:00.000Z");

function testimonial(overrides: Partial<TestimonialDoc> = {}): TestimonialDoc {
  const now = new Date("2026-10-01T09:00:00.000Z");
  return {
    feedbackId: null,
    ownerId: null,
    quote: "A real quote.",
    authorName: "Alex Morgan",
    authorRole: "Director",
    company: "Example Care",
    consentText: "I agree to this testimonial being published.",
    consentAt: now,
    status: "approved",
    approvedById: "admin-1",
    approvedAt,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describeWithDatabase("GET /api/testimonials", () => {
  useTestDatabase();

  it("returns only approved, consented testimonials with whitelisted fields", async () => {
    const { testimonials } = await import("@/lib/server/db/collections");
    await (
      await testimonials()
    ).insertMany([
      testimonial(),
      testimonial({ status: "pending", approvedAt: null }),
      testimonial({ status: "rejected", approvedAt: null }),
      testimonial({ status: "withdrawn", approvedAt: null }),
      testimonial({ quote: "Missing consent wording.", consentText: "" }),
      testimonial({
        quote: "Missing consent time.",
        consentAt: null as unknown as Date,
      }),
      testimonial({ quote: "Missing approval time.", approvedAt: null }),
    ]);

    const { GET } = await import("@/app/api/testimonials/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect(response.headers.get("Cache-Control")).toContain(
      "stale-while-revalidate",
    );

    const body = (await response.json()) as {
      testimonials: Record<string, unknown>[];
    };
    expect(body.testimonials).toHaveLength(1);
    expect(body.testimonials[0]).toEqual({
      quote: "A real quote.",
      name: "Alex Morgan",
      role: "Director",
      company: "Example Care",
      approvedAt: approvedAt.toISOString(),
    });
    expect(Object.keys(body.testimonials[0]).sort()).toEqual([
      "approvedAt",
      "company",
      "name",
      "quote",
      "role",
    ]);
  });

  it("returns an empty list when nothing is publishable", async () => {
    const { testimonials } = await import("@/lib/server/db/collections");
    await (await testimonials()).deleteMany({});
    await (
      await testimonials()
    ).insertOne(testimonial({ status: "pending", approvedAt: null }));

    const { GET } = await import("@/app/api/testimonials/route");
    const body = (await (await GET()).json()) as { testimonials: unknown[] };

    expect(body.testimonials).toEqual([]);
  });
});
