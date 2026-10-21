import { beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import type { JobContext } from "@/lib/server/jobs/worker";
import type { ContactEnquiryDoc } from "@/lib/server/db/types";

const growth = vi.hoisted(() => ({ leadScoring: true, aiEnabled: false }));

vi.mock("@/lib/server/settings", () => ({
  getSettingsFresh: async () => ({ growth }),
}));

function context(): JobContext {
  return {
    jobId: "job_lead_score_1",
    attempts: 1,
    log: () => {},
    deadline: Date.now() + 60_000,
  };
}

describeWithDatabase("lead.score job", () => {
  useTestDatabase();

  beforeEach(async () => {
    growth.leadScoring = true;
    growth.aiEnabled = false;
    const { contactEnquiries, leadActivities } =
      await import("@/lib/server/db/collections");
    await (await contactEnquiries()).deleteMany({});
    await (await leadActivities()).deleteMany({});
  });

  it("scores a changed lead once and leaves the stage alone", async () => {
    const { contactEnquiries, leadActivities } =
      await import("@/lib/server/db/collections");
    const { handleLeadScore } =
      await import("@/lib/server/jobs/handlers/lead-score");

    const inserted = await (
      await contactEnquiries()
    ).insertOne({
      requestId: "req_score_1",
      reference: "BC-SCORE01",
      name: "Dr Asha Mehta",
      email: "asha@clinic.example.in",
      company: "Mehta Clinic",
      budget: "₹5 lakh – ₹15 lakh",
      message:
        "Our clinic needs online appointment booking and automated patient reminders.",
      role: null,
      source: "website-contact",
      status: "new",
      stage: "new",
      emailStatus: "sent",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ContactEnquiryDoc);

    const first = await handleLeadScore({}, context());
    expect(first.scored).toBe(1);

    const stored = await (
      await contactEnquiries()
    ).findOne({
      _id: inserted.insertedId,
    });
    expect(stored?.stage).toBe("new");
    expect(stored?.status).toBe("new");
    expect(stored?.score).toBeGreaterThanOrEqual(35);
    expect(stored?.grade).toBeTruthy();
    expect(stored?.scoredAt).toBeInstanceOf(Date);
    expect(stored?.qualification ?? null).toBeNull();

    const activities = await (await leadActivities()).find({}).toArray();
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      leadKind: "enquiry",
      type: "scored",
    });

    // Nothing changed, so a second run must not rewrite or re-log the score.
    const second = await handleLeadScore({}, context());
    expect(second.scored).toBe(0);
    expect(await (await leadActivities()).countDocuments({})).toBe(1);
  });

  it("returns disabled without touching documents when the toggle is off", async () => {
    growth.leadScoring = false;
    const { contactEnquiries } = await import("@/lib/server/db/collections");
    const { handleLeadScore } =
      await import("@/lib/server/jobs/handlers/lead-score");

    await (
      await contactEnquiries()
    ).insertOne({
      requestId: "req_score_2",
      reference: "BC-SCORE02",
      name: "Untouched",
      email: "untouched@example.in",
      company: null,
      budget: null,
      message: "Website help please.",
      role: null,
      source: "website-contact",
      status: "new",
      emailStatus: "sent",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ContactEnquiryDoc);

    const result = await handleLeadScore({}, context());
    expect(result).toEqual({ skipped: "disabled" });

    const stored = await (
      await contactEnquiries()
    ).findOne({
      email: "untouched@example.in",
    });
    expect(stored?.score ?? null).toBeNull();
  });
});
